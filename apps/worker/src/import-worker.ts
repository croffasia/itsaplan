import { getStorageSettings, mimeAllowed, MB } from '@repo/db';
import { startPollLoop, type WorkerHandle } from './poll-loop';
import { intEnv } from './env';
import { tickErrorOutcome } from './import-retry';
import {
  importSourceNames,
  readerForJob,
  sourceProjectKeyForJob,
  type CommonImportConfig,
} from './import-sources';
import type { SourceReader } from './reader';
import type {
  CanonicalAttachment,
  CanonicalChecklist,
  CanonicalComment,
  CanonicalIssue,
  CanonicalWorklog,
} from './canonical';
import { resolveAttachmentLinks } from './inline-attachments';
import { extractCrossReferences, applyCrossReferenceReplacements } from './cross-reference';
import { downloadAttachment } from './attachment-download';
import {
  claimDueImportJobs,
  decryptImportCredential,
  saveImportJobCursor,
  saveImportJobSourceProject,
  advanceImportJobPhase,
  completeImportJob,
  failImportJob,
  retryImportJobLater,
  insertDiscoveredIds,
  upsertImportRecord,
  findImportRecord,
  findImportRecordByDisplayId,
  listImportRecords,
  listUncreatedImportRecords,
  listCreatedImportRecords,
  firstProjectColumnId,
  getProjectKey,
  getIssueSequenceNumber,
  getIssueTexts,
  updateIssueText,
  createLocalStateAndRecord,
  createLocalLabel,
  createLocalCycleAndRecord,
  createLocalIssueAndRecord,
  setIssueLabels,
  addIssueWatchers,
  createLocalCustomFieldAndRecord,
  setIssueCustomFieldValue,
  createLocalChecklistAndRecord,
  setIssueParentIfUnset,
  createLocalComment,
  createIssueLink,
  findProjectMemberUserId,
  createLocalAttachmentAndRecord,
  createLocalIssueTypeAndRecord,
  createLocalInitiativeAndRecord,
  createLocalWorklogAndRecord,
  turnOnProjectTracking,
  importedAttachmentPaths,
  getInitiativeDescription,
  updateInitiativeDescription,
  AttachmentRejectedError,
  type AttachmentOwner,
  type ClaimedImportJob,
  type NewLocalAttachment,
} from './import-store';

// The poll loop that drives a source import through its phases: discover ->
// create -> link -> rewrite -> attachments -> done. Follows the same claim-a-lease,
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

async function tick(): Promise<void> {
  const [job] = await claimDueImportJobs(importSourceNames());
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
      case 'rewrite':
        await runRewrite(job);
        break;
      case 'attachments':
        await runAttachments(job, reader);
        break;
      default:
        await completeImportJob(job.id);
    }
  } catch (error) {
    await handleTickError(job, error);
  }
}

async function handleTickError(job: ClaimedImportJob, error: unknown): Promise<void> {
  const outcome = tickErrorOutcome(error, job.attempts);
  if (outcome.action === 'fail') {
    await failImportJob(job.id, outcome.lastError);
    return;
  }
  await retryImportJobLater(job.id, outcome.delayMs, outcome.lastError, outcome.countsAsAttempt);
}

function buildReader(job: ClaimedImportJob): SourceReader {
  return readerForJob(job, decryptImportCredential(job));
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
    await saveImportJobSourceProject(job.id, await reader.describeSource());
    const [states, labels, cycles, customFields, issueTypes, initiatives] = await Promise.all([
      reader.listStates(),
      reader.listLabels(),
      reader.listCycles(),
      reader.listCustomFields(),
      reader.listIssueTypes?.() ?? [],
      reader.listInitiatives?.() ?? [],
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
    await insertDiscoveredIds(
      job.id,
      'custom_field',
      customFields.map((f) => f.sourceId),
    );
    await insertDiscoveredIds(
      job.id,
      'issue_type',
      issueTypes.map((t) => t.sourceId),
    );
    await insertDiscoveredIds(
      job.id,
      'initiative',
      initiatives.map((i) => i.sourceId),
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

// --- Create: materialize states/labels/cycles/custom fields once (cheap, unpaginated),
// then finish one chunk of issues per tick, with their
// comments and their attachment metadata (byte download is a later phase).

interface RecordCursor {
  lastRecordId: number;
}

export async function runCreate(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  await materializeStates(job, reader);
  await materializeLabels(job, reader);
  await materializeCycles(job, reader);
  await materializeCustomFields(job, reader);
  await materializeIssueTypes(job, reader);
  await materializeInitiatives(job, reader);

  const cursor = job.cursor as Partial<RecordCursor>;
  const afterId = cursor.lastRecordId ?? 0;
  const pending = await listImportRecords(job.id, 'issue', afterId, ISSUES_PER_TICK);
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

// stateOverrides (Plane state id -> itsaplan category) comes from the mapping review
// step at job creation; only newly-created columns are affected, never a dedup-matched
// existing one - createLocalStateAndRecord already never touches an existing match's
// stateType.
async function materializeStates(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await listUncreatedImportRecords(job.id, 'state', 0, 1000);
  if (pending.length === 0) return;
  const overrides = (job.config as CommonImportConfig).stateOverrides ?? {};
  const states = new Map((await reader.listStates()).map((s) => [s.sourceId, s]));
  for (const record of pending) {
    const state = states.get(record.sourceId);
    if (!state) continue;
    const category = overrides[record.sourceId] ?? state.category;
    await createLocalStateAndRecord(job.id, record.sourceId, job.projectId, {
      ...state,
      category,
    });
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

async function materializeCustomFields(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await listUncreatedImportRecords(job.id, 'custom_field', 0, 1000);
  if (pending.length === 0) return;
  const fields = new Map((await reader.listCustomFields()).map((f) => [f.sourceId, f]));
  for (const record of pending) {
    const field = fields.get(record.sourceId);
    if (!field) continue;
    await createLocalCustomFieldAndRecord(job.id, record.sourceId, job.projectId, field);
  }
}

// Every record of the type not created yet, page after page: an issue that names one
// is created after these, and never looks for it again.
async function uncreatedRecords(jobId: number, entityType: 'issue_type' | 'initiative') {
  const all = [];
  for (let afterId = 0; ;) {
    const page = await listUncreatedImportRecords(jobId, entityType, afterId, 1000);
    if (page.length === 0) return all;
    all.push(...page);
    afterId = page[page.length - 1]!.id;
  }
}

async function materializeIssueTypes(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await uncreatedRecords(job.id, 'issue_type');
  if (pending.length === 0 || !reader.listIssueTypes) return;
  const types = new Map((await reader.listIssueTypes()).map((t) => [t.sourceId, t]));
  for (const record of pending) {
    const type = types.get(record.sourceId);
    if (!type) continue;
    await createLocalIssueTypeAndRecord(job.id, record.sourceId, job.projectId, type);
  }
}

// After the labels: an initiative carries some of them.
async function materializeInitiatives(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const pending = await uncreatedRecords(job.id, 'initiative');
  if (pending.length === 0 || !reader.listInitiatives) return;
  const initiatives = new Map((await reader.listInitiatives()).map((i) => [i.sourceId, i]));
  for (const record of pending) {
    const item = initiatives.get(record.sourceId);
    if (!item) continue;
    const ownerUserId = item.ownerEmail
      ? await findProjectMemberUserId(job.projectId, item.ownerEmail)
      : null;
    await createLocalInitiativeAndRecord(job.id, item, {
      projectId: job.projectId,
      ownerUserId,
      labelIds: await localLabelIds(job.id, item.labelSourceIds),
    });
  }
}

async function localLabelIds(jobId: number, sourceIds: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const sourceId of sourceIds) {
    const record = await findImportRecord(jobId, 'label', sourceId);
    if (record?.localId != null) ids.push(record.localId);
  }
  return ids;
}

// A negative count is not an estimate an issue can hold, and minutes are whole.
function points(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

function minutes(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

async function createOneIssue(
  job: ClaimedImportJob,
  reader: SourceReader,
  sourceId: string,
): Promise<void> {
  const canonical = await reader.getIssue(sourceId);
  // Fetch source data before writing local rows; a failed read leaves no partial writes.
  const comments = await reader.listIssueComments(sourceId);
  const attachments = await reader.listIssueAttachments(sourceId);
  const checklists = await reader.listIssueChecklists(sourceId);
  const worklogs = (await reader.listIssueWorklogs?.(sourceId)) ?? [];

  const existing = await findImportRecord(job.id, 'issue', sourceId);
  let localId = existing?.localId;
  if (localId == null) {
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
    const typeRecord = canonical.typeSourceId
      ? await findImportRecord(job.id, 'issue_type', canonical.typeSourceId)
      : null;
    const initiativeRecord = canonical.initiativeSourceId
      ? await findImportRecord(job.id, 'initiative', canonical.initiativeSourceId)
      : null;

    localId = await createLocalIssueAndRecord(job.id, sourceId, String(canonical.sequenceId), {
      projectId: job.projectId,
      columnId,
      typeId: typeRecord?.localId ?? null,
      initiativeId: initiativeRecord?.localId ?? null,
      cycleId: cycleRecord?.localId ?? null,
      parentId: parentRecord?.localId ?? null,
      assigneeUserId,
      title: canonical.title,
      description: canonical.descriptionMarkdown,
      priority: canonical.priority,
      startDate: canonical.startDate,
      dueDate: canonical.dueDate,
      estimatePoints: points(canonical.estimatePoints),
      estimateMinutes: minutes(canonical.estimateMinutes),
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
      archivedAt: canonical.archivedAt,
    });
  }
  const labelIds = await localLabelIds(job.id, canonical.labelSourceIds);
  if (labelIds.length) await setIssueLabels(localId, labelIds);

  await addWatchers(job, localId, canonical.watcherEmails);
  await setCustomFieldValues(job, localId, canonical.customFields);
  await createChecklists(job, localId, checklists);
  await createComments(job, localId, comments);
  const logged = await createWorklogs(job, localId, worklogs);
  await turnOnProjectTracking(job.projectId, {
    points: points(canonical.estimatePoints) != null,
    time: minutes(canonical.estimateMinutes) != null,
    logging: logged,
  });

  if (attachments.length) {
    await insertDiscoveredIds(
      job.id,
      'attachment',
      attachments.map((a) => a.sourceId),
    );
  }
}

async function addWatchers(
  job: ClaimedImportJob,
  issueLocalId: number,
  emails: string[],
): Promise<void> {
  const userIds: string[] = [];
  for (const email of emails) {
    const userId = await findProjectMemberUserId(job.projectId, email);
    if (userId) userIds.push(userId);
  }
  await addIssueWatchers(issueLocalId, userIds);
}

async function setCustomFieldValues(
  job: ClaimedImportJob,
  issueLocalId: number,
  values: CanonicalIssue['customFields'],
): Promise<void> {
  for (const { fieldSourceId, value } of values) {
    if (value === null || value === '') continue;
    const record = await findImportRecord(job.id, 'custom_field', fieldSourceId);
    if (record?.localId == null) continue;
    await setIssueCustomFieldValue(issueLocalId, record.localId, value);
  }
}

async function createChecklists(
  job: ClaimedImportJob,
  issueLocalId: number,
  checklists: CanonicalChecklist[],
): Promise<void> {
  for (const checklist of checklists) {
    if ((await findImportRecord(job.id, 'checklist', checklist.sourceId))?.localId != null)
      continue;
    await createLocalChecklistAndRecord(job.id, issueLocalId, checklist);
  }
}

// An entry whose author matched no project member is left out: it would count
// toward nobody's time. True when the issue has at least one entry.
async function createWorklogs(
  job: ClaimedImportJob,
  issueLocalId: number,
  worklogs: CanonicalWorklog[],
): Promise<boolean> {
  let logged = false;
  for (const worklog of worklogs) {
    if (worklog.minutes < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(worklog.spentOn)) continue;
    if ((await findImportRecord(job.id, 'worklog', worklog.sourceId))?.localId != null) {
      logged = true;
      continue;
    }
    const userId = worklog.authorEmail
      ? await findProjectMemberUserId(job.projectId, worklog.authorEmail)
      : null;
    if (!userId) continue;
    await createLocalWorklogAndRecord(job.id, issueLocalId, userId, {
      ...worklog,
      minutes: Math.round(worklog.minutes),
    });
    logged = true;
  }
  return logged;
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
  const unmatchedUserPolicy = (job.config as CommonImportConfig).unmatchedUserPolicy;
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
    // 'skip' drops a comment whose author matched no project member, rather than
    // creating it unattributed. A comment with no authorEmail at all (Plane gave no
    // address to match) is unaffected - there was never a member to match against.
    if (comment.authorEmail && !authorUserId && unmatchedUserPolicy === 'skip') continue;
    const replyToId = comment.replyToSourceId
      ? (localIdBySourceId.get(comment.replyToSourceId) ?? null)
      : null;
    const localId = await createLocalComment(
      job.id,
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
    await advanceImportJobPhase(job.id, 'rewrite', {});
    return;
  }
  for (const record of pending) {
    const canonical = await reader.getIssue(record.sourceId);
    if (canonical.parentSourceId) {
      const parentRecord = await findImportRecord(job.id, 'issue', canonical.parentSourceId);
      if (parentRecord?.localId != null) {
        await setIssueParentIfUnset(job.projectId, record.localId, parentRecord.localId);
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

// --- Rewrite: a description or comment that mentions the source's own issue
// number ("ROOMS-524") still says that after Create — this phase resolves any
// such mention that lands inside the imported set and rewrites it to this
// project's own identifier. Purely local: everything it needs was captured
// during Create/Link, so it makes no further Plane requests.

// A mention of the issue whose own text this is stays as written: it is how a
// source records the issue's own identifier ("Imported from Linear: ATO-505").
async function rewriteCrossReferences(
  jobId: number,
  sourceProjectKey: string,
  localProjectKey: string,
  issueLocalId: number | null,
  text: string,
): Promise<string> {
  const references = extractCrossReferences(text, sourceProjectKey);
  if (references.length === 0) return text;

  const replacements = new Map<string, string>();
  for (const { reference, sequenceId } of references) {
    const record = await findImportRecordByDisplayId(jobId, 'issue', sequenceId);
    if (record?.localId == null || record.localId === issueLocalId) continue;
    const targetSequence = await getIssueSequenceNumber(record.localId);
    if (targetSequence == null) continue;
    replacements.set(reference, `${localProjectKey}-${targetSequence}`);
  }
  return applyCrossReferenceReplacements(text, sourceProjectKey, replacements);
}

// The issues first, then the initiatives, each keyed on import_record's own id.
interface OwnerCursor extends RecordCursor {
  owner?: 'initiative';
}

export async function runRewrite(job: ClaimedImportJob): Promise<void> {
  const cursor = job.cursor as Partial<OwnerCursor>;
  if (cursor.owner === 'initiative') {
    await rewriteInitiatives(job, cursor.lastRecordId ?? 0);
    return;
  }
  const afterId = cursor.lastRecordId ?? 0;
  const pending = await listCreatedImportRecords(job.id, 'issue', afterId, ISSUES_PER_TICK);
  if (pending.length === 0) {
    const next: OwnerCursor = { owner: 'initiative', lastRecordId: 0 };
    await saveImportJobCursor(job.id, next);
    return;
  }

  // A job created before this phase existed has no source project key — its
  // text is left exactly as Create wrote it.
  const sourceProjectKey = sourceProjectKeyForJob(job);
  if (sourceProjectKey) {
    const localProjectKey = await getProjectKey(job.projectId);
    for (const record of pending) {
      for (const piece of await getIssueTexts(record.localId)) {
        const next = await rewriteCrossReferences(
          job.id,
          sourceProjectKey,
          localProjectKey,
          record.localId,
          piece.text,
        );
        if (next !== piece.text) await updateIssueText(piece, next);
      }
    }
  }

  const next: RecordCursor = { lastRecordId: pending[pending.length - 1]!.id };
  await saveImportJobCursor(job.id, next);
}

async function rewriteInitiatives(job: ClaimedImportJob, afterId: number): Promise<void> {
  const pending = await listCreatedImportRecords(job.id, 'initiative', afterId, ISSUES_PER_TICK);
  const sourceProjectKey = sourceProjectKeyForJob(job);
  if (pending.length === 0 || !sourceProjectKey) {
    await advanceImportJobPhase(job.id, 'attachments', {});
    return;
  }
  const localProjectKey = await getProjectKey(job.projectId);
  for (const record of pending) {
    const description = await getInitiativeDescription(record.localId);
    const next = await rewriteCrossReferences(
      job.id,
      sourceProjectKey,
      localProjectKey,
      null,
      description,
    );
    if (next !== description) await updateInitiativeDescription(record.localId, next);
  }
  const next: OwnerCursor = { owner: 'initiative', lastRecordId: pending[pending.length - 1]!.id };
  await saveImportJobCursor(job.id, next);
}

// --- Attachments: metadata (filename, content type, size) was already listed
// per-issue during Create, but never the bytes — those need a fresh
// resolve-then-fetch of the two-hop, hour-lived S3 redirect right before each
// download (see "Attachments" in the notes file), so this phase re-lists each
// issue's attachments rather than reusing anything captured earlier.

export async function runAttachments(job: ClaimedImportJob, reader: SourceReader): Promise<void> {
  const cursor = job.cursor as Partial<OwnerCursor>;
  const owner = cursor.owner === 'initiative' ? 'initiative' : 'issue';
  const afterId = cursor.lastRecordId ?? 0;
  const pending = await listCreatedImportRecords(job.id, owner, afterId, ISSUES_PER_TICK);
  if (pending.length === 0) {
    if (owner === 'issue') {
      const next: OwnerCursor = { owner: 'initiative', lastRecordId: 0 };
      await saveImportJobCursor(job.id, next);
      return;
    }
    await completeImportJob(job.id);
    return;
  }
  for (const record of pending) {
    if (owner === 'issue') {
      const attachments = await reader.listIssueAttachments(record.sourceId);
      await storeAttachments(
        job,
        reader,
        record.sourceId,
        { issueId: record.localId },
        attachments,
      );
      await pointIssueTextAtFiles(job.id, record.localId);
    } else {
      const attachments = (await reader.listInitiativeAttachments?.(record.sourceId)) ?? [];
      await storeAttachments(
        job,
        reader,
        record.sourceId,
        { initiativeId: record.localId },
        attachments,
      );
      await pointInitiativeTextAtFiles(job.id, record.localId);
    }
  }
  const next: OwnerCursor = {
    ...(owner === 'initiative' ? { owner } : {}),
    lastRecordId: pending[pending.length - 1]!.id,
  };
  await saveImportJobCursor(job.id, next);
}

async function storeAttachments(
  job: ClaimedImportJob,
  reader: SourceReader,
  ownerSourceId: string,
  owner: AttachmentOwner,
  attachments: CanonicalAttachment[],
): Promise<void> {
  const limits = await getStorageSettings();
  for (const attachment of attachments) {
    if ((await findImportRecord(job.id, 'attachment', attachment.sourceId))?.localId != null) {
      continue;
    }
    try {
      // The source's own advertised size/type skip an obviously-too-large or
      // disallowed file before spending a download on it; the authoritative
      // check is still the real downloaded byte count, in
      // createLocalAttachmentAndRecord.
      if (attachment.sizeBytes > limits.maxAttachmentMb * MB) {
        throw new AttachmentRejectedError(
          `"${attachment.filename}" is ${Math.ceil(attachment.sizeBytes / MB)} MB, over the ${limits.maxAttachmentMb} MB limit`,
        );
      }
      if (!mimeAllowed(attachment.contentType, limits.attachmentMimeTypes)) {
        throw new AttachmentRejectedError(
          `"${attachment.filename}" is type "${attachment.contentType}", not accepted on this instance`,
        );
      }
      const download = await reader.resolveAttachmentDownload(ownerSourceId, attachment.sourceId);
      const bytes = await downloadAttachment(download, limits.maxAttachmentMb * MB);
      const input: NewLocalAttachment = {
        projectId: job.projectId,
        ...owner,
        filename: attachment.filename,
        contentType: attachment.contentType,
        bytes,
      };
      await createLocalAttachmentAndRecord(job.id, attachment.sourceId, input);
    } catch (error) {
      if (!(error instanceof AttachmentRejectedError)) throw error;
      console.error(
        `[import ${job.id}] attachment ${attachment.sourceId} rejected:`,
        error.message,
      );
    }
  }
}

// Once an owner's files are stored, its text points at them; a file that was not
// stored leaves its link text.
async function pointIssueTextAtFiles(jobId: number, issueId: number): Promise<void> {
  const paths = await importedAttachmentPaths(jobId, { issueId });
  for (const piece of await getIssueTexts(issueId)) {
    const next = resolveAttachmentLinks(piece.text, (id) => paths.get(id));
    if (next !== piece.text) await updateIssueText(piece, next);
  }
}

async function pointInitiativeTextAtFiles(jobId: number, initiativeId: number): Promise<void> {
  const paths = await importedAttachmentPaths(jobId, { initiativeId });
  const description = await getInitiativeDescription(initiativeId);
  const next = resolveAttachmentLinks(description, (id) => paths.get(id));
  if (next !== description) await updateInitiativeDescription(initiativeId, next);
}
