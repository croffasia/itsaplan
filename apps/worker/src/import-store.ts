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
export async function claimDueImportJobs(limit = 1): Promise<ClaimedImportJob[]> {
  const rows = await db.execute(sql`
    UPDATE import_job j
    SET attempts = j.attempts + 1,
        next_attempt_at = now() + make_interval(secs => ${LEASE_SECONDS})
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
): Promise<void> {
  await executor
    .insert(importRecord)
    .values({
      importJobId: jobId,
      sourceEntityType: entityType,
      sourceId,
      localEntityType,
      localId,
    })
    .onConflictDoUpdate({
      target: [importRecord.importJobId, importRecord.sourceEntityType, importRecord.sourceId],
      set: { localEntityType, localId },
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

// Creates the local column and records its import_record mapping in one
// transaction, so a crash between the two can never leave a create-then-
// retry pair that duplicates the column — unlike a label, which upserts on
// its own (project_id, name) unique constraint, a project_column has nothing
// to fall back on for a retry.
export async function createLocalStateAndRecord(
  jobId: number,
  sourceId: string,
  projectId: number,
  state: CanonicalState,
): Promise<number> {
  return db.transaction(async (tx) => {
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

// Same atomicity reasoning as createLocalStateAndRecord: a cycle has no
// unique constraint to protect a retry, so the create and the import_record
// mapping commit together.
export async function createLocalCycleAndRecord(
  jobId: number,
  sourceId: string,
  projectId: number,
  canonicalCycle: CanonicalCycle,
): Promise<number> {
  return db.transaction(async (tx) => {
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

// Sequence numbers ("MKT-42") are issued under a row lock on project, the same
// pattern apps/api's createIssue uses, so a bulk import never collides with a
// concurrent interactive create. The import_record mapping is written in the
// same transaction as the insert: an issue has no unique constraint a retry
// could fall back on (a fresh sequence number is issued every time), so a
// crash between the insert and the mapping would otherwise duplicate the
// issue on the next attempt.
export async function createLocalIssueAndRecord(
  jobId: number,
  sourceId: string,
  input: NewLocalIssue,
): Promise<number> {
  return db.transaction(async (tx) => {
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
    await upsertImportRecordWith(tx, jobId, 'issue', sourceId, 'issue', row!.id);
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

export async function createLocalComment(
  issueId: number,
  authorUserId: string | null,
  authorName: string,
  bodyMarkdown: string,
  createdAt: Date,
  replyToId: number | null,
): Promise<number> {
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
