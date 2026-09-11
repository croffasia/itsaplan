import {
  db,
  project,
  projectColumn,
  label,
  cycle,
  issue,
  issueLabel,
  issueActivity,
  issueLink,
  user,
  projectMember,
  importJob,
  importRecord,
  type ImportSource,
} from '@repo/db';
import { and, eq, gt, isNull, isNotNull, sql } from 'drizzle-orm';
import { decryptSecret, type EncryptedSecret } from '@repo/crypto';
import type { CanonicalState, CanonicalLabel, CanonicalCycle } from './canonical';
import type { PlaneCredential } from './plane-adapter';

// All @repo/db access for the Plane import: claiming due import_job rows (the
// same FOR UPDATE SKIP LOCKED + lease pattern as store.ts uses for
// webhook_delivery), reading/writing a job's progress, the import_record
// upsert primitive, and creating the local rows an import produces. The
// credential decrypt lives here rather than packages/db/src/domains/: that
// directory is for config more than one process reads, and only the worker
// ever decrypts an import job's stored credential — the api only sees the raw
// token once, at creation, before it is encrypted.

const LEASE_SECONDS = 120;

export interface ClaimedImportJob {
  id: number;
  projectId: number;
  source: ImportSource;
  phase: string;
  status: string;
  config: Record<string, unknown>;
  cursor: Record<string, unknown>;
  attempts: number;
  credentialCiphertext: string | null;
  credentialIv: string | null;
  credentialAuthTag: string | null;
}

// Claims up to `limit` due import jobs (default 1: import-worker.ts processes
// one job per tick). Claiming pushes next_attempt_at forward by the lease and
// bumps attempts, so a job whose worker crashes mid-tick becomes claimable
// again once the lease expires — status stays 'pending' throughout, the same
// as webhook_delivery, so the lease alone drives crash recovery.
//
// last_error is cleared here too, the moment a claim starts a new attempt —
// not only on success. The Settings UI reads a non-null last_error as "waiting
// out a retry" (see SettingsImportExportJobRow.tsx), computing the countdown
// from next_attempt_at; without this, a poll landing while the new attempt is
// still in flight would show the old error next to the lease's own deadline
// (up to LEASE_SECONDS out) as if it were the retry countdown, even though the
// job is actively working, not waiting.
export async function claimDueImportJobs(limit = 1): Promise<ClaimedImportJob[]> {
  const rows = await db.execute(sql`
    UPDATE import_job j
    SET attempts = j.attempts + 1,
        next_attempt_at = now() + make_interval(secs => ${LEASE_SECONDS}),
        last_error = NULL
    WHERE j.id IN (
      SELECT id FROM import_job
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY next_attempt_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING
      j.id,
      j.project_id AS "projectId",
      j.source,
      j.phase,
      j.status,
      j.config,
      j.cursor,
      j.attempts,
      j.credential_ciphertext AS "credentialCiphertext",
      j.credential_iv AS "credentialIv",
      j.credential_auth_tag AS "credentialAuthTag"
  `);
  return rows as unknown as ClaimedImportJob[];
}

export function decryptImportCredential(job: ClaimedImportJob): PlaneCredential {
  if (!job.credentialCiphertext || !job.credentialIv || !job.credentialAuthTag) {
    throw new Error(`import job ${job.id} has no stored credential`);
  }
  const encrypted: EncryptedSecret = {
    ciphertext: job.credentialCiphertext,
    iv: job.credentialIv,
    authTag: job.credentialAuthTag,
  };
  return JSON.parse(decryptSecret(encrypted)) as PlaneCredential;
}

// A successful tick clears the claim lease (nextAttemptAt) and lastError, and
// resets attempts, so the next tick can claim the job right away instead of
// waiting out the lease claimDueImportJobs set, and a resolved rate limit or
// transient failure doesn't linger as if it were still happening. `attempts`
// counts consecutive claims with no successful tick in between, not ticks
// claimed overall, so a transient error only fails the job after MAX_ATTEMPTS
// in a row.
export async function saveImportJobCursor(jobId: number, cursor: object): Promise<void> {
  await db
    .update(importJob)
    .set({ cursor, attempts: 0, nextAttemptAt: sql`now()`, lastError: null, updatedAt: new Date() })
    .where(eq(importJob.id, jobId));
}

export async function advanceImportJobPhase(
  jobId: number,
  phase: string,
  cursor: object,
): Promise<void> {
  await db
    .update(importJob)
    .set({
      phase,
      cursor,
      attempts: 0,
      nextAttemptAt: sql`now()`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(importJob.id, jobId));
}

// Terminal states clear the credential columns: nothing needs to read them
// again once the job can no longer make progress.
export async function completeImportJob(jobId: number): Promise<void> {
  await db
    .update(importJob)
    .set({
      status: 'completed',
      phase: 'done',
      lastError: null,
      updatedAt: new Date(),
      credentialCiphertext: null,
      credentialIv: null,
      credentialAuthTag: null,
    })
    .where(eq(importJob.id, jobId));
}

export async function failImportJob(jobId: number, error: string): Promise<void> {
  await db
    .update(importJob)
    .set({
      status: 'failed',
      lastError: error.slice(0, 500),
      updatedAt: new Date(),
      credentialCiphertext: null,
      credentialIv: null,
      credentialAuthTag: null,
    })
    .where(eq(importJob.id, jobId));
}

// A transient failure (rate limited, a network error, an unreachable
// instance): reschedule rather than fail the job outright.
export async function retryImportJobLater(
  jobId: number,
  delayMs: number,
  error: string,
): Promise<void> {
  const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));
  await db
    .update(importJob)
    .set({
      nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`,
      lastError: error.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(importJob.id, jobId));
}

export type ImportEntityType = 'issue' | 'comment' | 'label' | 'state' | 'cycle' | 'attachment';

// Bulk id-only snapshot write for the Discover phase: rows start with no local
// mapping. Idempotent — a source id already recorded (from an earlier attempt
// at this same phase) is left alone.
export async function insertDiscoveredIds(
  jobId: number,
  entityType: ImportEntityType,
  sourceIds: string[],
): Promise<void> {
  if (sourceIds.length === 0) return;
  await db
    .insert(importRecord)
    .values(
      sourceIds.map((sourceId) => ({ importJobId: jobId, sourceEntityType: entityType, sourceId })),
    )
    .onConflictDoNothing();
}

// Runs against either the plain db or a transaction, so the local-row insert
// and the import_record upsert below can share one transaction and commit
// atomically — see createLocalStateAndRecord/createLocalCycleAndRecord/
// createLocalIssueAndRecord.
type ImportDbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// The idempotent-upsert primitive keyed on the unique index
// (import_job_id, source_entity_type, source_id): inserts a fresh mapping, or
// overwrites the local mapping of one that already exists (Discover wrote it
// with no local id, Create is now filling it in).
async function upsertImportRecordWith(
  executor: ImportDbExecutor,
  jobId: number,
  entityType: ImportEntityType,
  sourceId: string,
  localEntityType: ImportEntityType | null,
  localId: number | null,
  sourceDisplayId: string | null = null,
): Promise<void> {
  await executor
    .insert(importRecord)
    .values({
      importJobId: jobId,
      sourceEntityType: entityType,
      sourceId,
      sourceDisplayId,
      localEntityType,
      localId,
    })
    .onConflictDoUpdate({
      target: [importRecord.importJobId, importRecord.sourceEntityType, importRecord.sourceId],
      set: { localEntityType, localId, sourceDisplayId },
    });
}

export async function upsertImportRecord(
  jobId: number,
  entityType: ImportEntityType,
  sourceId: string,
  localEntityType: ImportEntityType | null,
  localId: number | null,
): Promise<void> {
  await upsertImportRecordWith(db, jobId, entityType, sourceId, localEntityType, localId);
}

export async function findImportRecord(
  jobId: number,
  entityType: ImportEntityType,
  sourceId: string,
): Promise<{ localId: number | null } | null> {
  const rows = await db
    .select({ localId: importRecord.localId })
    .from(importRecord)
    .where(
      and(
        eq(importRecord.importJobId, jobId),
        eq(importRecord.sourceEntityType, entityType),
        eq(importRecord.sourceId, sourceId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// Resolves a cross-reference like "ROOMS-524" during the Rewrite phase: the
// captured number is the source's own display id, not its sourceId (a UUID for
// Plane), so this looks up by the column Create stashed it in instead.
export async function findImportRecordByDisplayId(
  jobId: number,
  entityType: ImportEntityType,
  sourceDisplayId: string,
): Promise<{ localId: number | null } | null> {
  const rows = await db
    .select({ localId: importRecord.localId })
    .from(importRecord)
    .where(
      and(
        eq(importRecord.importJobId, jobId),
        eq(importRecord.sourceEntityType, entityType),
        eq(importRecord.sourceDisplayId, sourceDisplayId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface ImportRecordRow {
  id: number;
  sourceId: string;
}

// The next chunk of this job's snapshot that has not been materialized yet,
// keyset-paginated on import_record's own id — itsaplan's own position in the
// snapshot list, not the source's pagination cursor (see the notes file). A
// retried tick naturally skips rows a crashed earlier attempt already created,
// since those no longer match "local id still null".
export async function listUncreatedImportRecords(
  jobId: number,
  entityType: ImportEntityType,
  afterId: number,
  limit: number,
): Promise<ImportRecordRow[]> {
  return db
    .select({ id: importRecord.id, sourceId: importRecord.sourceId })
    .from(importRecord)
    .where(
      and(
        eq(importRecord.importJobId, jobId),
        eq(importRecord.sourceEntityType, entityType),
        gt(importRecord.id, afterId),
        isNull(importRecord.localId),
      ),
    )
    .orderBy(importRecord.id)
    .limit(limit);
}

export interface CreatedImportRecordRow extends ImportRecordRow {
  // Guaranteed set by the isNotNull(localId) filter below; the column itself
  // is nullable so the query builder can't narrow it on its own.
  localId: number;
}

// The next chunk of this job's already-created issues, for the Link phase to
// fetch relations for.
export async function listCreatedImportRecords(
  jobId: number,
  entityType: ImportEntityType,
  afterId: number,
  limit: number,
): Promise<CreatedImportRecordRow[]> {
  const rows = await db
    .select({ id: importRecord.id, sourceId: importRecord.sourceId, localId: importRecord.localId })
    .from(importRecord)
    .where(
      and(
        eq(importRecord.importJobId, jobId),
        eq(importRecord.sourceEntityType, entityType),
        gt(importRecord.id, afterId),
        isNotNull(importRecord.localId),
      ),
    )
    .orderBy(importRecord.id)
    .limit(limit);
  return rows as CreatedImportRecordRow[];
}

export async function firstProjectColumnId(projectId: number): Promise<number | null> {
  const rows = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(eq(projectColumn.projectId, projectId))
    .orderBy(projectColumn.position)
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getProjectKey(projectId: number): Promise<string> {
  const [row] = await db
    .select({ key: project.key })
    .from(project)
    .where(eq(project.id, projectId));
  if (!row) throw new Error(`project ${projectId} not found`);
  return row.key;
}

export async function getIssueSequenceNumber(issueId: number): Promise<number | null> {
  const [row] = await db
    .select({ sequenceNumber: issue.sequenceNumber })
    .from(issue)
    .where(eq(issue.id, issueId));
  return row?.sequenceNumber ?? null;
}

export interface IssueTextForRewrite {
  description: string;
  comments: { id: number; body: string }[];
}

// What the Rewrite phase scans: the issue's own description plus every comment
// on it, each already local (no more Plane requests needed for this phase).
export async function getIssueTextForRewrite(issueId: number): Promise<IssueTextForRewrite> {
  const [issueRow] = await db
    .select({ description: issue.description })
    .from(issue)
    .where(eq(issue.id, issueId));
  const comments = await db
    .select({ id: issueActivity.id, body: issueActivity.body })
    .from(issueActivity)
    .where(and(eq(issueActivity.issueId, issueId), eq(issueActivity.kind, 'comment')));
  return {
    description: issueRow?.description ?? '',
    comments: comments.map((c) => ({ id: c.id, body: c.body ?? '' })),
  };
}

export async function updateIssueDescription(issueId: number, description: string): Promise<void> {
  await db.update(issue).set({ description }).where(eq(issue.id, issueId));
}

export async function updateCommentBody(commentId: number, body: string): Promise<void> {
  await db.update(issueActivity).set({ body }).where(eq(issueActivity.id, commentId));
}

// project_column has no unique constraint to upsert against like label does,
// so an exact name match within the project is looked up first and reused —
// otherwise every project's own default columns (every new project starts
// with a "Backlog") collide with Plane's own states of the same name and
// duplicate them. A match reuses the existing column's stateType rather than
// overwriting it with Plane's category: unlike a label's color, a column's
// category can move issues between board sections, so an import should not
// silently change how an existing, possibly hand-configured column behaves.
// The lookup and the insert-or-reuse share one transaction for the same
// crash-safety reason as before — a project_column still has nothing to fall
// back on for a retry once created.
export async function createLocalStateAndRecord(
  jobId: number,
  sourceId: string,
  projectId: number,
  state: CanonicalState,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: projectColumn.id })
      .from(projectColumn)
      .where(and(eq(projectColumn.projectId, projectId), eq(projectColumn.name, state.name)));
    if (existing) {
      await upsertImportRecordWith(tx, jobId, 'state', sourceId, 'state', existing.id);
      return existing.id;
    }
    const [posRow] = await tx
      .select({ pos: sql<number>`COALESCE(MAX(${projectColumn.position}), 0) + 1` })
      .from(projectColumn)
      .where(eq(projectColumn.projectId, projectId));
    const [row] = await tx
      .insert(projectColumn)
      .values({
        projectId,
        name: state.name,
        stateType: state.category,
        position: Number(posRow!.pos),
      })
      .returning({ id: projectColumn.id });
    await upsertImportRecordWith(tx, jobId, 'state', sourceId, 'state', row!.id);
    return row!.id;
  });
}

// A label of the same name already existing (created by hand before the
// import ran) is reused rather than duplicated, matching label's own
// unique(project_id, name).
export async function createLocalLabel(
  projectId: number,
  canonicalLabel: CanonicalLabel,
): Promise<number> {
  const color = canonicalLabel.color ?? '#6b7280';
  const [row] = await db
    .insert(label)
    .values({ projectId, name: canonicalLabel.name, color })
    .onConflictDoUpdate({ target: [label.projectId, label.name], set: { color } })
    .returning({ id: label.id });
  return row!.id;
}

// Same name-match-and-reuse reasoning as createLocalStateAndRecord: a cycle
// has no unique constraint to upsert against, so an existing cycle of the
// same name is reused rather than duplicated.
export async function createLocalCycleAndRecord(
  jobId: number,
  sourceId: string,
  projectId: number,
  canonicalCycle: CanonicalCycle,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: cycle.id })
      .from(cycle)
      .where(and(eq(cycle.projectId, projectId), eq(cycle.name, canonicalCycle.name)));
    if (existing) {
      await upsertImportRecordWith(tx, jobId, 'cycle', sourceId, 'cycle', existing.id);
      return existing.id;
    }
    const [row] = await tx
      .insert(cycle)
      .values({
        projectId,
        name: canonicalCycle.name,
        goal: canonicalCycle.goal ?? '',
        startDate: canonicalCycle.startDate,
        endDate: canonicalCycle.endDate,
      })
      .returning({ id: cycle.id });
    await upsertImportRecordWith(tx, jobId, 'cycle', sourceId, 'cycle', row!.id);
    return row!.id;
  });
}

export interface NewLocalIssue {
  projectId: number;
  columnId: number;
  cycleId: number | null;
  parentId: number | null;
  assigneeUserId: string | null;
  title: string;
  description: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
}

// An issue whose title matches one already in the project (case- and
// whitespace-insensitive, the same comparison the file-based importer uses)
// is reused instead of duplicated — the same protection createLocalLabel and
// createLocalStateAndRecord give their own entities. Comments and labels the
// import attaches afterward land on that existing issue rather than being
// orphaned. Skipped for a blank title: input.title falls back to
// '(untitled)' below, and matching on that fallback would merge every
// untitled Plane issue into whichever one happened to import first, which is
// not a duplicate in any real sense.
//
// Sequence numbers ("MKT-42") are issued under a row lock on project, the
// same pattern apps/api's createIssue uses, so a bulk import never collides
// with a concurrent interactive create. The import_record mapping is written
// in the same transaction as the insert: an issue has no unique constraint a
// retry could fall back on (a fresh sequence number is issued every time),
// so a crash between the insert and the mapping would otherwise duplicate
// the issue on the next attempt. sourceDisplayId (the source's own issue
// number) is stashed on that same mapping either way, for the Rewrite phase.
export async function createLocalIssueAndRecord(
  jobId: number,
  sourceId: string,
  sourceDisplayId: string,
  input: NewLocalIssue,
): Promise<number> {
  return db.transaction(async (tx) => {
    if (input.title.trim()) {
      const [existing] = await tx
        .select({ id: issue.id })
        .from(issue)
        .where(
          and(
            eq(issue.projectId, input.projectId),
            sql`lower(btrim(${issue.title})) = lower(btrim(${input.title}))`,
          ),
        );
      if (existing) {
        await upsertImportRecordWith(
          tx,
          jobId,
          'issue',
          sourceId,
          'issue',
          existing.id,
          sourceDisplayId,
        );
        return existing.id;
      }
    }
    const [seqRow] = await tx
      .update(project)
      .set({ nextSequence: sql`next_sequence + 1` })
      .where(eq(project.id, input.projectId))
      .returning({ seq: sql<number>`next_sequence - 1` });
    const [posRow] = await tx
      .select({ pos: sql<number>`COALESCE(MAX(${issue.position}), 0) + 1000` })
      .from(issue)
      .where(eq(issue.columnId, input.columnId));
    const [row] = await tx
      .insert(issue)
      .values({
        projectId: input.projectId,
        sequenceNumber: Number(seqRow!.seq),
        columnId: input.columnId,
        cycleId: input.cycleId,
        parentId: input.parentId,
        assigneeUserId: input.assigneeUserId,
        title: input.title || '(untitled)',
        description: input.description,
        priority: input.priority,
        startDate: input.startDate,
        dueDate: input.dueDate,
        position: Number(posRow!.pos),
      })
      .returning({ id: issue.id });
    await upsertImportRecordWith(tx, jobId, 'issue', sourceId, 'issue', row!.id, sourceDisplayId);
    return row!.id;
  });
}

export async function setIssueLabels(issueId: number, labelIds: number[]): Promise<void> {
  if (labelIds.length === 0) return;
  await db
    .insert(issueLabel)
    .values(labelIds.map((labelId) => ({ issueId, labelId })))
    .onConflictDoNothing();
}

// A comment already on the issue with the same body and createdAt (the two
// fields Plane's own record carries verbatim) is reused instead of
// duplicated — the same reuse-by-content protection issues, states, and
// cycles get, needed here because a second import job resolves the parent
// issue to the same, already-created row and would otherwise re-post every
// comment on it.
export async function createLocalComment(
  issueId: number,
  authorUserId: string | null,
  authorName: string,
  bodyMarkdown: string,
  createdAt: Date,
  replyToId: number | null,
): Promise<number> {
  const [existing] = await db
    .select({ id: issueActivity.id })
    .from(issueActivity)
    .where(
      and(
        eq(issueActivity.issueId, issueId),
        eq(issueActivity.kind, 'comment'),
        eq(issueActivity.body, bodyMarkdown),
        eq(issueActivity.createdAt, createdAt),
      ),
    );
  if (existing) return existing.id;

  const [row] = await db
    .insert(issueActivity)
    .values({
      issueId,
      kind: 'comment',
      body: bodyMarkdown,
      actorUserId: authorUserId,
      actorName: authorName,
      replyToId,
      createdAt,
    })
    .returning({ id: issueActivity.id });
  return row!.id;
}

// Sets an issue's parent the first time one resolves. Create sets parentId from
// whatever import_record knows at that moment, which misses a sub-issue processed
// before its parent exists; Link revisits every issue a second time (see runLink)
// and calls this once the parent is resolvable. The parent_id IS NULL guard makes
// a retry a no-op and never overwrites a parent Create already got right.
export async function setIssueParentIfUnset(issueId: number, parentId: number): Promise<void> {
  if (issueId === parentId) return;
  await db
    .update(issue)
    .set({ parentId })
    .where(and(eq(issue.id, issueId), isNull(issue.parentId)));
}

// issue_link's unique index is on the unordered pair + kind, so re-running the
// Link phase for an issue whose relations were already created is a no-op:
// the duplicate insert is caught and dropped rather than failing the tick.
export async function createIssueLink(
  sourceIssueId: number,
  targetIssueId: number,
  kind: string,
): Promise<void> {
  if (sourceIssueId === targetIssueId) return;
  try {
    await db.insert(issueLink).values({ sourceIssueId, targetIssueId, kind });
  } catch (err) {
    if (isUniqueViolation(err)) return;
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

// Only a user who already belongs to the project is matched: an import never
// adds someone to the project on its own just because their email matched a
// Plane assignee or comment author.
export async function findProjectMemberUserId(
  projectId: number,
  email: string,
): Promise<string | null> {
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(and(eq(projectMember.projectId, projectId), sql`lower(${user.email}) = lower(${email})`))
    .limit(1);
  return rows[0]?.userId ?? null;
}
