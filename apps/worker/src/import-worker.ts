import { startPollLoop, type WorkerHandle } from './poll-loop';
import { intEnv } from './env';
import { equalJitterBackoffMs } from './backoff';
import { PlaneReader, PlaneRateLimitedError } from './plane-adapter';
import type { SourceReader } from './reader';
import type { CanonicalComment } from './canonical';
import {
  claimDueImportJobs,
  decryptImportCredential,
  saveImportJobCursor,
  advanceImportJobPhase,
  completeImportJob,
  failImportJob,
  retryImportJobLater,
  insertDiscoveredIds,
  upsertImportRecord,
  findImportRecord,
  listUncreatedImportRecords,
  listCreatedImportRecords,
  firstProjectColumnId,
  createLocalStateAndRecord,
  createLocalLabel,
  createLocalCycleAndRecord,
  createLocalIssueAndRecord,
  setIssueLabels,
  setIssueParentIfUnset,
  createLocalComment,
  createIssueLink,
  findProjectMemberUserId,
  type ClaimedImportJob,
} from './import-store';

// The poll loop that drives a Plane import through its phases: discover ->
// create -> link -> attachments -> done. Follows the same claim-a-lease,
// bounded-chunk-per-tick shape as worker.ts and agent-worker.ts. Each tick
// claims at most one due import_job and advances it by one bounded unit of
// work, then reschedules — a large import interleaves across many ticks
// rather than running to completion in one.
export function startImportWorker(): WorkerHandle {
  return startPollLoop('import-worker', tick, () => intEnv('IMPORT_POLL_INTERVAL_MS', 3000));
}

// How many issues Create/Link process per tick. Each issue costs several
// additional Plane requests (comments, attachments, relations) against a
// ~60 requests/minute budget, so this stays well under the discover page size.
const ISSUES_PER_TICK = 15;
// import_store.ts resets job.attempts to 0 on every tick that makes progress
// (saveImportJobCursor/advanceImportJobPhase), so this counts consecutive
// failed ticks, not total ticks claimed over the job's life — a multi-tick
// import doesn't fail itself out just by running long.
const MAX_ATTEMPTS = 10;

async function tick(): Promise<void> {
  const [job] = await claimDueImportJobs();
  if (!job) return;
  try {
    const reader = buildReader(job);
    switch (job.phase) {
      case 'discover':
        await runDiscover(job, reader);
        break;
      case 'create':
        await runCreate(job, reader);
        break;
      case 'link':
        await runLink(job, reader);
        break;
      case 'attachments':
        await runAttachments(job);
        break;
      default:
        await completeImportJob(job.id);
    }
  } catch (error) {
    await handleTickError(job, error);
  }
}

async function handleTickError(job: ClaimedImportJob, error: unknown): Promise<void> {
  if (error instanceof PlaneRateLimitedError) {
    await retryImportJobLater(job.id, error.retryAfterMs, 'rate limited');
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (job.attempts >= MAX_ATTEMPTS) {
    await failImportJob(job.id, message);
    return;
  }
  await retryImportJobLater(job.id, equalJitterBackoffMs(job.attempts), message);
}

interface PlaneImportConfig {
  planeProjectId: string;
}

function buildReader(job: ClaimedImportJob): SourceReader {
  const credential = decryptImportCredential(job);
  const config = job.config as Partial<PlaneImportConfig>;
  if (!config.planeProjectId)
    throw new Error(`import job ${job.id} has no source project configured`);
  return new PlaneReader(credential, config.planeProjectId);
}

// --- Discover: snapshot every source id up front, writing import_record rows
// with no local mapping yet. Plane's own pagination cursor is not a safe
// resumability anchor across a job that can span many ticks (see "Pagination"
// in docs/dev/plane-import-source-notes.md) — Create resumes from this
// snapshot instead, keyed on import_record's own id.

interface DiscoverCursor {
  subphase: 'meta' | 'issues';
  planeCursor: string | null;
}

async function runDiscover(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const cursor = job.cursor as Partial<DiscoverCursor>;
  if (cursor.subphase !== 'issues') {
    const [states, labels, cycles] = await Promise.all([
      reader.listStates(),
      reader.listLabels(),
      reader.listCycles(),
    ]);
    await insertDiscoveredIds(
      job.id,
      'state',
      states.map((s) => s.sourceId),
    );
    await insertDiscoveredIds(
      job.id,
      'label',
      labels.map((l) => l.sourceId),
    );
    await insertDiscoveredIds(
      job.id,
      'cycle',
      cycles.map((c) => c.sourceId),
    );
    const next: DiscoverCursor = { subphase: 'issues', planeCursor: null };
    await saveImportJobCursor(job.id, next);
    return;
  }

  const page = await reader.listIssues(cursor.planeCursor ?? null);
  await insertDiscoveredIds(
    job.id,
    'issue',
    page.items.map((i) => i.sourceId),
  );
  if (page.cursor === null) {
    await advanceImportJobPhase(job.id, 'create', {});
    return;
  }
  const next: DiscoverCursor = { subphase: 'issues', planeCursor: page.cursor };
  await saveImportJobCursor(job.id, next);
}

// --- Create: materialize states/labels/cycles once (cheap, unpaginated),
// then create one chunk of not-yet-created issues per tick, with their
// comments and their attachment metadata (byte download is a later phase).

interface RecordCursor {
  lastRecordId: number;
}

async function runCreate(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  await materializeStates(job, reader);
  await materializeLabels(job, reader);
  await materializeCycles(job, reader);

  const cursor = job.cursor as Partial<RecordCursor>;
  const afterId = cursor.lastRecordId ?? 0;
  const pending = await listUncreatedImportRecords(job.id, 'issue', afterId, ISSUES_PER_TICK);
  if (pending.length === 0) {
    await advanceImportJobPhase(job.id, 'link', {});
    return;
  }
  for (const record of pending) {
    await createOneIssue(job, reader, record.sourceId);
  }
  const next: RecordCursor = { lastRecordId: pending[pending.length - 1]!.id };
  await saveImportJobCursor(job.id, next);
}

async function materializeStates(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await listUncreatedImportRecords(job.id, 'state', 0, 1000);
  if (pending.length === 0) return;
  const states = new Map((await reader.listStates()).map((s) => [s.sourceId, s]));
  for (const record of pending) {
    const state = states.get(record.sourceId);
    if (!state) continue;
    await createLocalStateAndRecord(job.id, record.sourceId, job.projectId, state);
  }
}

async function materializeLabels(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await listUncreatedImportRecords(job.id, 'label', 0, 1000);
  if (pending.length === 0) return;
  const labels = new Map((await reader.listLabels()).map((l) => [l.sourceId, l]));
  for (const record of pending) {
    const label = labels.get(record.sourceId);
    if (!label) continue;
    const localId = await createLocalLabel(job.projectId, label);
    await upsertImportRecord(job.id, 'label', record.sourceId, 'label', localId);
  }
}

async function materializeCycles(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await listUncreatedImportRecords(job.id, 'cycle', 0, 1000);
  if (pending.length === 0) return;
  const cycles = new Map((await reader.listCycles()).map((c) => [c.sourceId, c]));
  for (const record of pending) {
    const cycle = cycles.get(record.sourceId);
    if (!cycle) continue;
    await createLocalCycleAndRecord(job.id, record.sourceId, job.projectId, cycle);
  }
}

async function createOneIssue(
  job: ClaimedImportJob,
  reader: SourceReader,
  sourceId: string,
): Promise<void> {
  const canonical = await reader.getIssue(sourceId);

  const stateRecord = await findImportRecord(job.id, 'state', canonical.stateSourceId);
  const columnId = stateRecord?.localId ?? (await firstProjectColumnId(job.projectId));
  if (columnId == null)
    throw new Error(`project ${job.projectId} has no workflow column to import into`);

  const cycleRecord = canonical.cycleSourceId
    ? await findImportRecord(job.id, 'cycle', canonical.cycleSourceId)
    : null;
  const parentRecord = canonical.parentSourceId
    ? await findImportRecord(job.id, 'issue', canonical.parentSourceId)
    : null;
  const assigneeUserId = canonical.assigneeEmail
    ? await findProjectMemberUserId(job.projectId, canonical.assigneeEmail)
    : null;

  const labelIds: number[] = [];
  for (const labelSourceId of canonical.labelSourceIds) {
    const record = await findImportRecord(job.id, 'label', labelSourceId);
    if (record?.localId != null) labelIds.push(record.localId);
  }

  const localId = await createLocalIssueAndRecord(job.id, sourceId, {
    projectId: job.projectId,
    columnId,
    cycleId: cycleRecord?.localId ?? null,
    parentId: parentRecord?.localId ?? null,
    assigneeUserId,
    title: canonical.title,
    description: canonical.descriptionMarkdown,
    priority: canonical.priority,
    startDate: canonical.startDate,
    dueDate: canonical.dueDate,
  });
  if (labelIds.length) await setIssueLabels(localId, labelIds);

  await createComments(job, localId, await reader.listIssueComments(sourceId));

  const attachments = await reader.listIssueAttachments(sourceId);
  if (attachments.length) {
    await insertDiscoveredIds(
      job.id,
      'attachment',
      attachments.map((a) => a.sourceId),
    );
  }
}

// Comments are recorded in import_record too (entity type 'comment'), so a
// crashed-and-retried tick does not insert the same comment twice — issue_
// activity carries no unique constraint of its own to fall back on.
// Processed in the order Plane returned them, which is assumed chronological,
// so a reply's parent is created before the reply itself.
async function createComments(
  job: ClaimedImportJob,
  issueLocalId: number,
  comments: CanonicalComment[],
): Promise<void> {
  const localIdBySourceId = new Map<string, number>();
  for (const comment of comments) {
    const existing = await findImportRecord(job.id, 'comment', comment.sourceId);
    if (existing?.localId != null) {
      localIdBySourceId.set(comment.sourceId, existing.localId);
      continue;
    }
    const authorUserId = comment.authorEmail
      ? await findProjectMemberUserId(job.projectId, comment.authorEmail)
      : null;
    const replyToId = comment.replyToSourceId
      ? (localIdBySourceId.get(comment.replyToSourceId) ?? null)
      : null;
    const localId = await createLocalComment(
      issueLocalId,
      authorUserId,
      comment.authorName,
      comment.bodyMarkdown,
      new Date(comment.createdAt),
      replyToId,
    );
    await upsertImportRecord(job.id, 'comment', comment.sourceId, 'comment', localId);
    localIdBySourceId.set(comment.sourceId, localId);
  }
}

// --- Link: for each created issue, fetch its relations and create the ones
// with a destination in itsaplan's issue_link.kind (see "Relations vs.
// dependencies" in the notes file). Also gives every issue's parent link a
// second chance to resolve: Create only knew what import_record held at the
// moment it ran, so a sub-issue processed before its parent existed was left
// with no parent — by Link, every issue in the job has been created.

async function runLink(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const cursor = job.cursor as Partial<RecordCursor>;
  const afterId = cursor.lastRecordId ?? 0;
  const pending = await listCreatedImportRecords(job.id, 'issue', afterId, ISSUES_PER_TICK);
  if (pending.length === 0) {
    await advanceImportJobPhase(job.id, 'attachments', {});
    return;
  }
  for (const record of pending) {
    const canonical = await reader.getIssue(record.sourceId);
    if (canonical.parentSourceId) {
      const parentRecord = await findImportRecord(job.id, 'issue', canonical.parentSourceId);
      if (parentRecord?.localId != null) {
        await setIssueParentIfUnset(record.localId, parentRecord.localId);
      }
    }
    const relations = await reader.listIssueRelations(record.sourceId);
    for (const relation of relations) {
      const targetRecord = await findImportRecord(job.id, 'issue', relation.targetIssueSourceId);
      if (targetRecord?.localId == null) continue;
      await createIssueLink(record.localId, targetRecord.localId, relation.kind);
    }
  }
  const next: RecordCursor = { lastRecordId: pending[pending.length - 1]!.id };
  await saveImportJobCursor(job.id, next);
}

// --- Attachments: metadata (filename, content type) was already captured
// per-issue during Create. Downloading the actual bytes needs a fresh
// resolve-then-fetch of the two-hop, hour-lived S3 redirect right before each
// download (see "Attachments" in the notes file) and is not part of this
// milestone's SourceReader — this phase just closes the job out.
async function runAttachments(job: ClaimedImportJob): Promise<void> {
  await completeImportJob(job.id);
}
