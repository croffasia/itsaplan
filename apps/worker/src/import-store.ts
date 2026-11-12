import {
  db,
  project,
  projectColumn,
  label,
  labelGroup,
  cycle,
  issue,
  issueType,
  issueWorklog,
  initiative,
  initiativeLabel,
  initiativeAttachment,
  issueLabel,
  issueActivity,
  issueLink,
  issueAttachment,
  issueWatcher,
  issueChecklist,
  issueChecklistItem,
  customField,
  customFieldOption,
  issueFieldValue,
  issueFieldOption,
  user,
  projectMember,
  importJob,
  importRecord,
  getStorageSettings,
  mimeAllowed,
  MB,
  projectStoredBytes,
  lockAttachmentStorage,
  lockIssueTree,
  parentLinkProblem,
} from '@repo/db';
import { and, eq, gt, inArray, isNull, isNotNull, or, sql, type Column } from 'drizzle-orm';
import { decryptSecret, type EncryptedSecret } from '@repo/crypto';
import {
  putObject,
  deleteObject,
  safeAttachmentFilename,
  attachmentObjectKey,
} from '@repo/storage';
import type {
  CanonicalState,
  CanonicalLabel,
  CanonicalCycle,
  CanonicalCustomField,
  CanonicalChecklist,
  CanonicalIssueType,
  CanonicalInitiative,
  CanonicalWorklog,
} from './canonical';
import { AttachmentRejectedError } from './attachment-download';
import type { SourceProject } from './reader';

export { AttachmentRejectedError };

// All @repo/db access for a source import: claiming due import_job rows (the
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
  source: string;
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
// Only a job of one of `sources`: a worker of another build, which reads other sources, may
// share the database, and a job waits for a worker that reads it.
export async function claimDueImportJobs(
  sources: readonly string[],
  limit = 1,
): Promise<ClaimedImportJob[]> {
  if (sources.length === 0) return [];
  const rows = await db.execute(sql`
    UPDATE import_job j
    SET attempts = j.attempts + 1,
        next_attempt_at = now() + make_interval(secs => ${LEASE_SECONDS}),
        last_error = NULL
    WHERE j.id IN (
      SELECT id FROM import_job
      WHERE status = 'pending' AND next_attempt_at <= now()
        AND source IN (${sql.join(
          sources.map((source) => sql`${source}`),
          sql`, `,
        )})
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

export function decryptImportCredential(job: ClaimedImportJob): unknown {
  if (!job.credentialCiphertext || !job.credentialIv || !job.credentialAuthTag) {
    throw new Error(`import job ${job.id} has no stored credential`);
  }
  const encrypted: EncryptedSecret = {
    ciphertext: job.credentialCiphertext,
    iv: job.credentialIv,
    authTag: job.credentialAuthTag,
  };
  return JSON.parse(decryptSecret(encrypted));
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

const SOURCE_PROJECT_NAME_MAX = 200;

// The web renders a stored address as a link, so only an http(s) one is kept.
function httpUrl(value: string | null): string | null {
  const url = URL.canParse(value ?? '') ? new URL(value!) : null;
  return url && ['http:', 'https:'].includes(url.protocol) ? url.href : null;
}

export async function saveImportJobSourceProject(
  jobId: number,
  project: SourceProject,
): Promise<void> {
  await db
    .update(importJob)
    .set({
      sourceProjectName: project.name.trim().slice(0, SOURCE_PROJECT_NAME_MAX) || null,
      sourceProjectUrl: httpUrl(project.url),
    })
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
// instance): reschedule rather than fail the job outright. A tick that does not
// count as an attempt (a rate limit) gives back the bump its claim made.
export async function retryImportJobLater(
  jobId: number,
  delayMs: number,
  error: string,
  countsAsAttempt: boolean,
): Promise<void> {
  const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));
  await db
    .update(importJob)
    .set({
      ...(countsAsAttempt ? {} : { attempts: sql`greatest(${importJob.attempts} - 1, 0)` }),
      nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`,
      lastError: error.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(importJob.id, jobId));
}

export type ImportEntityType =
  | 'issue'
  | 'comment'
  | 'label'
  | 'state'
  | 'cycle'
  | 'attachment'
  | 'checklist'
  | 'custom_field'
  | 'issue_type'
  | 'initiative'
  | 'worklog'
  | 'initiative_attachment';

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

// True for a local row this job has not mapped yet. A row the same job already
// mapped belongs to another source record, so it is never that record's duplicate:
// two source issues may share a title, two comments a body and a timestamp. A row an
// earlier job mapped stays reusable, which is what makes a re-run not duplicate.
function notMappedByJob(jobId: number, entityType: ImportEntityType, localId: Column) {
  return sql`NOT EXISTS (
    SELECT 1 FROM ${importRecord}
    WHERE ${importRecord.importJobId} = ${jobId}
      AND ${importRecord.sourceEntityType} = ${entityType}
      AND ${importRecord.localId} = ${localId}
  )`;
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

export async function listImportRecords(
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
      ),
    )
    .orderBy(importRecord.id)
    .limit(limit);
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

// One piece of an issue's text: its description, a comment, or the value of a markdown
// custom field. `id` is the row it is kept in.
export interface IssueText {
  kind: 'description' | 'comment' | 'field';
  id: number;
  text: string;
}

// What the Rewrite and Attachments phases scan, each already local (no more source
// requests needed for them).
export async function getIssueTexts(issueId: number): Promise<IssueText[]> {
  const [issueRow] = await db
    .select({ description: issue.description })
    .from(issue)
    .where(eq(issue.id, issueId));
  const comments = await db
    .select({ id: issueActivity.id, body: issueActivity.body })
    .from(issueActivity)
    .where(and(eq(issueActivity.issueId, issueId), eq(issueActivity.kind, 'comment')));
  const fields = await db
    .select({ id: issueFieldValue.id, text: issueFieldValue.valueText })
    .from(issueFieldValue)
    .innerJoin(customField, eq(customField.id, issueFieldValue.fieldId))
    .where(and(eq(issueFieldValue.issueId, issueId), eq(customField.fieldType, 'markdown')));
  return [
    { kind: 'description', id: issueId, text: issueRow?.description ?? '' },
    ...comments.map((c) => ({ kind: 'comment' as const, id: c.id, text: c.body ?? '' })),
    ...fields.map((f) => ({ kind: 'field' as const, id: f.id, text: f.text ?? '' })),
  ];
}

export async function updateIssueText(piece: IssueText, text: string): Promise<void> {
  if (piece.kind === 'description') {
    await db.update(issue).set({ description: text }).where(eq(issue.id, piece.id));
  } else if (piece.kind === 'comment') {
    await db.update(issueActivity).set({ body: text }).where(eq(issueActivity.id, piece.id));
  } else {
    await db
      .update(issueFieldValue)
      .set({ valueText: text })
      .where(eq(issueFieldValue.id, piece.id));
  }
}

export async function getInitiativeDescription(initiativeId: number): Promise<string> {
  const [row] = await db
    .select({ description: initiative.description })
    .from(initiative)
    .where(eq(initiative.id, initiativeId));
  return row?.description ?? '';
}

export async function updateInitiativeDescription(
  initiativeId: number,
  description: string,
): Promise<void> {
  await db.update(initiative).set({ description }).where(eq(initiative.id, initiativeId));
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
// unique(project_id, name). A new label joins its group, made by name when the
// project lacks it; a reused one stays in the group it is in.
export async function createLocalLabel(
  projectId: number,
  canonicalLabel: CanonicalLabel,
): Promise<number> {
  const color = canonicalLabel.color ?? '#6b7280';
  const groupId = canonicalLabel.group ? await labelGroupId(projectId, canonicalLabel.group) : null;
  const [row] = await db
    .insert(label)
    .values({ projectId, name: canonicalLabel.name, color, groupId })
    .onConflictDoUpdate({ target: [label.projectId, label.name], set: { color } })
    .returning({ id: label.id });
  return row!.id;
}

async function labelGroupId(projectId: number, name: string): Promise<number> {
  await db.insert(labelGroup).values({ projectId, name }).onConflictDoNothing();
  const [row] = await db
    .select({ id: labelGroup.id })
    .from(labelGroup)
    .where(and(eq(labelGroup.projectId, projectId), eq(labelGroup.name, name)));
  return row!.id;
}

// An issue type of the same name is reused, matching issue_type's own
// unique(project_id, name).
export async function createLocalIssueTypeAndRecord(
  jobId: number,
  sourceId: string,
  projectId: number,
  type: CanonicalIssueType,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: issueType.id })
      .from(issueType)
      .where(and(eq(issueType.projectId, projectId), eq(issueType.name, type.name)));
    let typeId = existing?.id;
    if (typeId == null) {
      const [row] = await tx
        .insert(issueType)
        .values({
          projectId,
          name: type.name,
          position: sql<number>`(select coalesce(max(${issueType.position}), -1) + 1 from ${issueType} where ${eq(issueType.projectId, projectId)})`,
        })
        .returning({ id: issueType.id });
      typeId = row!.id;
    }
    await upsertImportRecordWith(tx, jobId, 'issue_type', sourceId, 'issue_type', typeId);
    return typeId;
  });
}

export interface NewLocalInitiative {
  projectId: number;
  ownerUserId: string | null;
  labelIds: number[];
}

// An initiative with the same title, not mapped by this job, is reused, the way an
// issue is: a second import of the same source lands on what the first one made.
export async function createLocalInitiativeAndRecord(
  jobId: number,
  item: CanonicalInitiative,
  input: NewLocalInitiative,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: initiative.id })
      .from(initiative)
      .where(
        and(
          eq(initiative.projectId, input.projectId),
          sql`lower(btrim(${initiative.title})) = lower(btrim(${item.title}))`,
          notMappedByJob(jobId, 'initiative', initiative.id),
        ),
      )
      .orderBy(initiative.id)
      .limit(1);
    let initiativeId = existing?.id;
    if (initiativeId == null) {
      const [row] = await tx
        .insert(initiative)
        .values({
          projectId: input.projectId,
          title: item.title || '(untitled)',
          description: item.descriptionMarkdown,
          status: item.status,
          ownerUserId: input.ownerUserId,
          priority: item.priority,
          startDate: item.startDate,
          targetDate: item.targetDate,
          position: sql<number>`(select coalesce(max(${initiative.position}), 0) + 1000 from ${initiative} where ${eq(initiative.projectId, input.projectId)})`,
          createdAt: sourceTimestamp(item.createdAt),
          updatedAt: sourceTimestamp(item.updatedAt),
        })
        .returning({ id: initiative.id });
      initiativeId = row!.id;
    }
    if (input.labelIds.length > 0) {
      await tx
        .insert(initiativeLabel)
        .values(input.labelIds.map((labelId) => ({ initiativeId: initiativeId!, labelId })))
        .onConflictDoNothing();
    }
    await upsertImportRecordWith(
      tx,
      jobId,
      'initiative',
      item.sourceId,
      'initiative',
      initiativeId,
    );
    return initiativeId;
  });
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
  typeId?: number | null;
  initiativeId?: number | null;
  cycleId: number | null;
  parentId: number | null;
  assigneeUserId: string | null;
  title: string;
  description: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  // The source's own ISO timestamps. Absent or unparseable leaves the column default, now().
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

function sourceTimestamp(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// An issue whose title matches one already in the project (case- and
// whitespace-insensitive, the same comparison the file-based importer uses), and
// that this job has not already mapped to another source issue, is reused
// instead of duplicated — the same protection createLocalLabel and
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
            notMappedByJob(jobId, 'issue', issue.id),
          ),
        )
        .orderBy(issue.id)
        .limit(1);
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
    const parentId =
      input.parentId !== null && !(await parentLinkProblem(null, input.parentId, tx))
        ? input.parentId
        : null;
    const [row] = await tx
      .insert(issue)
      .values({
        projectId: input.projectId,
        sequenceNumber: Number(seqRow!.seq),
        columnId: input.columnId,
        typeId: input.typeId ?? null,
        initiativeId: input.initiativeId ?? null,
        cycleId: input.cycleId,
        parentId,
        assigneeUserId: input.assigneeUserId,
        title: input.title || '(untitled)',
        description: input.description,
        priority: input.priority,
        startDate: input.startDate,
        dueDate: input.dueDate,
        estimatePoints: input.estimatePoints == null ? null : String(input.estimatePoints),
        estimateMinutes: input.estimateMinutes ?? null,
        position: Number(posRow!.pos),
        createdAt: sourceTimestamp(input.createdAt),
        updatedAt: sourceTimestamp(input.updatedAt),
        archivedAt: input.archivedAt ? (sourceTimestamp(input.archivedAt) ?? new Date()) : null,
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

// Turns on the estimate kinds and the time log the imported issues bring, so they
// show. The row is written only while one of them is still off.
export async function turnOnProjectTracking(
  projectId: number,
  tracking: { points: boolean; time: boolean; logging: boolean },
): Promise<void> {
  const columns = [
    ...(tracking.points ? [project.pointsEstimateEnabled] : []),
    ...(tracking.time ? [project.timeEstimateEnabled] : []),
    ...(tracking.logging ? [project.timeLoggingEnabled] : []),
  ];
  if (columns.length === 0) return;
  await db
    .update(project)
    .set({
      ...(tracking.points ? { pointsEstimateEnabled: true } : {}),
      ...(tracking.time ? { timeEstimateEnabled: true } : {}),
      ...(tracking.logging ? { timeLoggingEnabled: true } : {}),
    })
    .where(and(eq(project.id, projectId), or(...columns.map((column) => eq(column, false)))));
}

// An entry already on the issue for the same person, day, minutes and note, not
// mapped by this job, is reused: a second import of the same issue lands on it.
export async function createLocalWorklogAndRecord(
  jobId: number,
  issueId: number,
  userId: string,
  worklog: CanonicalWorklog,
): Promise<number> {
  return db.transaction(async (tx) => {
    const note = worklog.note?.trim() || null;
    const [existing] = await tx
      .select({ id: issueWorklog.id })
      .from(issueWorklog)
      .where(
        and(
          eq(issueWorklog.issueId, issueId),
          eq(issueWorklog.userId, userId),
          eq(issueWorklog.spentOn, worklog.spentOn),
          eq(issueWorklog.minutes, worklog.minutes),
          note === null ? isNull(issueWorklog.note) : eq(issueWorklog.note, note),
          notMappedByJob(jobId, 'worklog', issueWorklog.id),
        ),
      )
      .orderBy(issueWorklog.id)
      .limit(1);
    let worklogId = existing?.id;
    if (worklogId == null) {
      const [row] = await tx
        .insert(issueWorklog)
        .values({ issueId, userId, minutes: worklog.minutes, spentOn: worklog.spentOn, note })
        .returning({ id: issueWorklog.id });
      worklogId = row!.id;
    }
    await upsertImportRecordWith(tx, jobId, 'worklog', worklog.sourceId, 'worklog', worklogId);
    return worklogId;
  });
}

export async function addIssueWatchers(issueId: number, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await db
    .insert(issueWatcher)
    .values(userIds.map((userId) => ({ issueId, userId })))
    .onConflictDoNothing();
}

// A project-wide field with the same name and type is reused, and a select field
// gets the options it lacks. One with the same name and another type is not: the
// imported values would land in columns that field never reads.
export async function createLocalCustomFieldAndRecord(
  jobId: number,
  sourceId: string,
  projectId: number,
  field: CanonicalCustomField,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: customField.id })
      .from(customField)
      .where(
        and(
          eq(customField.projectId, projectId),
          isNull(customField.issueTypeId),
          eq(customField.name, field.name),
          eq(customField.fieldType, field.fieldType),
        ),
      )
      .orderBy(customField.id)
      .limit(1);
    let fieldId = existing?.id;
    if (fieldId == null) {
      const [posRow] = await tx
        .select({ pos: sql<number>`COALESCE(MAX(${customField.position}), -1) + 1` })
        .from(customField)
        .where(and(eq(customField.projectId, projectId), isNull(customField.issueTypeId)));
      const [row] = await tx
        .insert(customField)
        .values({
          projectId,
          name: field.name,
          fieldType: field.fieldType,
          memberScope: field.fieldType === 'member' ? 'humans' : null,
          position: Number(posRow!.pos),
        })
        .returning({ id: customField.id });
      fieldId = row!.id;
    }
    if (field.options.length > 0) {
      const [posRow] = await tx
        .select({ pos: sql<number>`COALESCE(MAX(${customFieldOption.position}), -1) + 1` })
        .from(customFieldOption)
        .where(eq(customFieldOption.fieldId, fieldId));
      await tx
        .insert(customFieldOption)
        .values(
          field.options.map((value, index) => ({
            fieldId: fieldId!,
            value,
            position: Number(posRow!.pos) + index,
          })),
        )
        .onConflictDoNothing();
    }
    await upsertImportRecordWith(tx, jobId, 'custom_field', sourceId, 'custom_field', fieldId);
    return fieldId;
  });
}

// Written in the column of the field's own type. A value the issue already holds is
// kept, the way a reused issue keeps its title. A member value is an email, matched
// with a project member; one that matches nobody is left out.
export async function setIssueCustomFieldValue(
  issueId: number,
  fieldId: number,
  value: string | number | boolean | string[],
): Promise<void> {
  const [field] = await db
    .select({ fieldType: customField.fieldType, projectId: customField.projectId })
    .from(customField)
    .where(eq(customField.id, fieldId));
  if (!field) return;
  if (field.fieldType === 'select' || field.fieldType === 'multi_select') {
    const texts = Array.isArray(value) ? value : [String(value)];
    if (texts.length === 0) return;
    const options = await db
      .select({ id: customFieldOption.id })
      .from(customFieldOption)
      .where(and(eq(customFieldOption.fieldId, fieldId), inArray(customFieldOption.value, texts)))
      .orderBy(customFieldOption.position);
    if (options.length === 0) return;
    const [held] = await db
      .select({ optionId: issueFieldOption.optionId })
      .from(issueFieldOption)
      .where(and(eq(issueFieldOption.issueId, issueId), eq(issueFieldOption.fieldId, fieldId)))
      .limit(1);
    if (held) return;
    const chosen = field.fieldType === 'select' ? options.slice(0, 1) : options;
    await db
      .insert(issueFieldOption)
      .values(chosen.map((option) => ({ issueId, fieldId, optionId: option.id })))
      .onConflictDoNothing();
    return;
  }
  let column: Partial<typeof issueFieldValue.$inferInsert>;
  switch (field.fieldType) {
    case 'number':
      column = { valueNumber: String(value) };
      break;
    case 'boolean':
      column = { valueBool: Boolean(value) };
      break;
    case 'date': {
      const day = String(value).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
      column = { valueDate: day };
      break;
    }
    case 'datetime': {
      const at = sourceTimestamp(String(value));
      if (!at) return;
      column = { valueDatetime: at };
      break;
    }
    case 'member': {
      const userId = await findProjectMemberUserId(field.projectId, String(value));
      if (!userId) return;
      column = { valueUserId: userId };
      break;
    }
    case 'url': {
      const url = httpUrl(String(value));
      if (!url) return;
      column = { valueText: url };
      break;
    }
    default:
      column = { valueText: Array.isArray(value) ? value.join(', ') : String(value) };
  }
  await db
    .insert(issueFieldValue)
    .values({ issueId, fieldId, ...column })
    .onConflictDoNothing();
}

// A checklist already on the issue with the same title, and not mapped by this job,
// is reused: a second import of the same source issue lands on the issue the first
// one created. The checklist, its items and the mapping are written together, so a
// retry never finds half of one.
export async function createLocalChecklistAndRecord(
  jobId: number,
  issueId: number,
  checklist: CanonicalChecklist,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: issueChecklist.id })
      .from(issueChecklist)
      .where(
        and(
          eq(issueChecklist.issueId, issueId),
          eq(issueChecklist.title, checklist.title),
          notMappedByJob(jobId, 'checklist', issueChecklist.id),
        ),
      )
      .orderBy(issueChecklist.id)
      .limit(1);
    if (existing) {
      await upsertImportRecordWith(
        tx,
        jobId,
        'checklist',
        checklist.sourceId,
        'checklist',
        existing.id,
      );
      return existing.id;
    }
    const [row] = await tx
      .insert(issueChecklist)
      .values({
        issueId,
        title: checklist.title,
        position: sql<number>`(select coalesce(max(${issueChecklist.position}), 0) + 1000 from ${issueChecklist} where ${eq(issueChecklist.issueId, issueId)})`,
      })
      .returning({ id: issueChecklist.id });
    if (checklist.items.length > 0) {
      await tx.insert(issueChecklistItem).values(
        checklist.items.map((item, index) => ({
          checklistId: row!.id,
          content: item.content,
          done: item.done,
          position: (index + 1) * 1000,
        })),
      );
    }
    await upsertImportRecordWith(tx, jobId, 'checklist', checklist.sourceId, 'checklist', row!.id);
    return row!.id;
  });
}

// A comment already on the issue with the same body and createdAt (the two
// fields Plane's own record carries verbatim), and not already mapped by this
// job, is reused instead of duplicated — the same reuse-by-content protection
// issues, states, and cycles get, needed here because a second import job
// resolves the parent issue to the same, already-created row and would otherwise
// re-post every comment on it.
export async function createLocalComment(
  jobId: number,
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
        notMappedByJob(jobId, 'comment', issueActivity.id),
      ),
    )
    .orderBy(issueActivity.id)
    .limit(1);
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
// a retry a no-op and never overwrites a parent Create already got right. A parent
// that would put the issue past MAX_SUBTASK_DEPTH, or under itself, is not set: the
// issue is imported without one.
export async function setIssueParentIfUnset(
  projectId: number,
  issueId: number,
  parentId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockIssueTree(tx, projectId);
    if (await parentLinkProblem(issueId, parentId, tx)) return;
    await tx
      .update(issue)
      .set({ parentId })
      .where(and(eq(issue.id, issueId), isNull(issue.parentId)));
  });
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

// drizzle wraps the driver error in a DrizzleQueryError and keeps the Postgres
// error in `cause`, so the code is looked for down the cause chain (the api's
// pgErrorCode does the same).
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
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

export type AttachmentOwner = { issueId: number } | { initiativeId: number };

export type NewLocalAttachment = {
  projectId: number;
  filename: string;
  contentType: string;
  bytes: Buffer;
} & AttachmentOwner;

// The path text stores an attachment by, which the web serves through /media.
export function attachmentPath(owner: 'issue' | 'initiative', publicId: string): string {
  return owner === 'issue'
    ? `/media/attachments/${publicId}/raw`
    : `/media/initiative-attachments/${publicId}/raw`;
}

// The stored files this job imported for one issue or initiative, by their source id.
export async function importedAttachmentPaths(
  jobId: number,
  owner: AttachmentOwner,
): Promise<Map<string, string>> {
  const rows =
    'issueId' in owner
      ? await db
          .select({ sourceId: importRecord.sourceId, publicId: issueAttachment.publicId })
          .from(importRecord)
          .innerJoin(issueAttachment, eq(issueAttachment.id, importRecord.localId))
          .where(
            and(
              eq(importRecord.importJobId, jobId),
              eq(importRecord.sourceEntityType, 'attachment'),
              eq(importRecord.localEntityType, 'attachment'),
              eq(issueAttachment.issueId, owner.issueId),
            ),
          )
      : await db
          .select({ sourceId: importRecord.sourceId, publicId: initiativeAttachment.publicId })
          .from(importRecord)
          .innerJoin(initiativeAttachment, eq(initiativeAttachment.id, importRecord.localId))
          .where(
            and(
              eq(importRecord.importJobId, jobId),
              eq(importRecord.sourceEntityType, 'attachment'),
              eq(importRecord.localEntityType, 'initiative_attachment'),
              eq(initiativeAttachment.initiativeId, owner.initiativeId),
            ),
          );
  const kind = 'issueId' in owner ? 'issue' : 'initiative';
  return new Map(rows.map((r) => [r.sourceId, attachmentPath(kind, r.publicId)]));
}

// Reuse-before-duplicate, the same shape as the other entities: an attachment
// already on this issue with the same filename is reused rather than re-uploaded
// on a second import run. Size, mime type, and project quota are all checked
// against the instance's own settings before the upload, so a file that cannot
// be stored never reaches the object store at all; the quota is checked once
// more inside the lock, right before the insert, the same two-step api's own
// upload route follows — the first check keeps a doomed-to-reject file off the
// object store, the second is the one a concurrent write can't slip past.
export async function createLocalAttachmentAndRecord(
  jobId: number,
  sourceId: string,
  input: NewLocalAttachment,
): Promise<number> {
  const filename = safeAttachmentFilename(input.filename);
  const onIssue = 'issueId' in input;
  const localType = onIssue ? 'attachment' : 'initiative_attachment';
  const [existing] = onIssue
    ? await db
        .select({ id: issueAttachment.id })
        .from(issueAttachment)
        .where(
          and(eq(issueAttachment.issueId, input.issueId), eq(issueAttachment.filename, filename)),
        )
    : await db
        .select({ id: initiativeAttachment.id })
        .from(initiativeAttachment)
        .where(
          and(
            eq(initiativeAttachment.initiativeId, input.initiativeId),
            eq(initiativeAttachment.filename, filename),
          ),
        );
  if (existing) {
    await upsertImportRecordWith(db, jobId, 'attachment', sourceId, localType, existing.id);
    return existing.id;
  }

  const limits = await getStorageSettings();
  if (input.bytes.length > limits.maxAttachmentMb * MB) {
    throw new AttachmentRejectedError(
      `"${filename}" is ${Math.ceil(input.bytes.length / MB)} MB, over the ${limits.maxAttachmentMb} MB limit`,
    );
  }
  if (!mimeAllowed(input.contentType, limits.attachmentMimeTypes)) {
    throw new AttachmentRejectedError(
      `"${filename}" is type "${input.contentType}", not accepted on this instance`,
    );
  }
  if (limits.projectQuotaMb > 0) {
    const used = await projectStoredBytes(input.projectId);
    if (used + input.bytes.length > limits.projectQuotaMb * MB) {
      throw new AttachmentRejectedError(
        `the project has used its ${limits.projectQuotaMb} MB storage quota`,
      );
    }
  }

  const key = onIssue
    ? attachmentObjectKey(input.projectId, 'attachments', input.issueId, filename)
    : attachmentObjectKey(input.projectId, 'initiatives', input.initiativeId, filename);
  await putObject(key, input.bytes, input.contentType);

  try {
    return await db.transaction(async (tx) => {
      await lockAttachmentStorage(tx, input.projectId);
      if (limits.projectQuotaMb > 0) {
        // Re-checked against the lock: the check above ran before the upload,
        // outside any lock, so a concurrent write could have landed since.
        const used = await projectStoredBytes(input.projectId, tx);
        if (used + input.bytes.length > limits.projectQuotaMb * MB) {
          throw new AttachmentRejectedError(
            `the project has used its ${limits.projectQuotaMb} MB storage quota`,
          );
        }
      }
      const file = {
        s3Key: key,
        filename,
        contentType: input.contentType,
        sizeBytes: input.bytes.length,
      };
      const [row] = onIssue
        ? await tx
            .insert(issueAttachment)
            .values({ issueId: input.issueId, ...file })
            .returning({ id: issueAttachment.id })
        : await tx
            .insert(initiativeAttachment)
            .values({ initiativeId: input.initiativeId, ...file })
            .returning({ id: initiativeAttachment.id });
      await upsertImportRecordWith(tx, jobId, 'attachment', sourceId, localType, row!.id);
      return row!.id;
    });
  } catch (error) {
    await deleteObject(key).catch(() => {});
    throw error;
  }
}
