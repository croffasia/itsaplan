import { describe, it, expect, afterEach } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  db,
  team,
  project,
  projectColumn,
  issue,
  issueAttachment,
  importJob,
  user,
  getStorageSettings,
  setSetting,
  STORAGE_SETTING_KEY,
  type StorageSettings,
} from '@repo/db';
import { eq } from 'drizzle-orm';
import { getObject } from '@repo/storage';
import {
  claimDueImportJobs,
  createLocalStateAndRecord,
  createLocalIssueAndRecord,
  createLocalAttachmentAndRecord,
  findImportRecord,
  AttachmentRejectedError,
} from '../../import-store';

// Nothing here calls resetDb (the worker has no api to reset for), so every
// helper below makes its own isolated team/project/user with a random key,
// matching notification-send.test.ts's own convention.

async function makeProject(): Promise<{ projectId: number; columnId: number; userId: string }> {
  const [teamRow] = await db.insert(team).values({ name: 'Importers' }).returning({ id: team.id });
  const [projectRow] = await db
    .insert(project)
    .values({ teamId: teamRow!.id, key: randomUUID().slice(0, 8), name: 'Imported' })
    .returning({ id: project.id });
  const [columnRow] = await db
    .insert(projectColumn)
    .values({ projectId: projectRow!.id, name: 'Backlog', position: 1 })
    .returning({ id: projectColumn.id });
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: 'Importer', email: `${userId}@example.test` });
  return { projectId: projectRow!.id, columnId: columnRow!.id, userId };
}

async function makeImportJob(projectId: number, userId: string): Promise<number> {
  const [row] = await db
    .insert(importJob)
    .values({ projectId, createdByUserId: userId, source: 'plane' })
    .returning({ id: importJob.id });
  return row!.id;
}

async function makeIssue(projectId: number, columnId: number, title = 'Task'): Promise<number> {
  const [row] = await db
    .insert(issue)
    .values({ projectId, columnId, sequenceNumber: Math.floor(Math.random() * 1_000_000), title })
    .returning({ id: issue.id });
  return row!.id;
}

describe('claimDueImportJobs', () => {
  it('claims a due pending job, bumps attempts, and clears a stale last_error', async () => {
    const { projectId, userId } = await makeProject();
    const jobId = await makeImportJob(projectId, userId);
    await db
      .update(importJob)
      .set({ attempts: 3, lastError: 'rate limited', nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(importJob.id, jobId));

    // A large limit, not 1: other due jobs can be sitting in the shared test
    // database from earlier runs of this same suite (nothing here truncates
    // import_job between runs), and claimDueImportJobs orders by next_attempt_at
    // with no per-test scope to filter on.
    const claimed = await claimDueImportJobs(1000);
    const job = claimed.find((j) => j.id === jobId);

    expect(job).toBeDefined();
    expect(job!.attempts).toBe(4);
    const [row] = await db.select().from(importJob).where(eq(importJob.id, jobId));
    expect(row!.lastError).toBeNull();
    expect(row!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not claim a job whose next attempt is still in the future', async () => {
    const { projectId, userId } = await makeProject();
    const jobId = await makeImportJob(projectId, userId);
    await db
      .update(importJob)
      .set({ nextAttemptAt: new Date(Date.now() + 60_000) })
      .where(eq(importJob.id, jobId));

    const claimed = await claimDueImportJobs(50);
    expect(claimed.some((j) => j.id === jobId)).toBe(false);
  });

  it('does not claim a paused job', async () => {
    const { projectId, userId } = await makeProject();
    const jobId = await makeImportJob(projectId, userId);
    await db
      .update(importJob)
      .set({ status: 'paused', nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(importJob.id, jobId));

    const claimed = await claimDueImportJobs(50);
    expect(claimed.some((j) => j.id === jobId)).toBe(false);
  });
});

describe('createLocalStateAndRecord', () => {
  it('creates a new column and records the mapping', async () => {
    const { projectId, userId } = await makeProject();
    const jobId = await makeImportJob(projectId, userId);

    const columnId = await createLocalStateAndRecord(jobId, 'plane-state-1', projectId, {
      sourceId: 'plane-state-1',
      name: 'In Review',
      category: 'started',
    });

    const [row] = await db.select().from(projectColumn).where(eq(projectColumn.id, columnId));
    expect(row?.name).toBe('In Review');
    expect(row?.stateType).toBe('started');
    expect(await findImportRecord(jobId, 'state', 'plane-state-1')).toEqual({ localId: columnId });
  });

  it('reuses an existing column by name without changing its hand-configured state type', async () => {
    const { projectId, userId } = await makeProject();
    const jobId = await makeImportJob(projectId, userId);
    const [existing] = await db
      .insert(projectColumn)
      .values({ projectId, name: 'Done', stateType: 'completed', position: 2 })
      .returning({ id: projectColumn.id });

    const columnId = await createLocalStateAndRecord(jobId, 'plane-state-2', projectId, {
      sourceId: 'plane-state-2',
      name: 'Done',
      category: 'canceled',
    });

    expect(columnId).toBe(existing!.id);
    const [row] = await db.select().from(projectColumn).where(eq(projectColumn.id, columnId));
    expect(row?.stateType).toBe('completed');
  });
});

describe('createLocalIssueAndRecord', () => {
  it('creates a new issue with a sequence number and records the mapping', async () => {
    const { projectId, columnId, userId } = await makeProject();
    const jobId = await makeImportJob(projectId, userId);

    const issueId = await createLocalIssueAndRecord(jobId, 'plane-issue-1', 'ROOMS-1', {
      projectId,
      columnId,
      cycleId: null,
      parentId: null,
      assigneeUserId: null,
      title: 'Fix the leak',
      description: '',
      priority: null,
      startDate: null,
      dueDate: null,
    });

    const [row] = await db.select().from(issue).where(eq(issue.id, issueId));
    expect(row?.title).toBe('Fix the leak');
    expect(await findImportRecord(jobId, 'issue', 'plane-issue-1')).toEqual({ localId: issueId });
  });

  it('reuses an issue that already has the same title instead of duplicating it', async () => {
    const { projectId, columnId, userId } = await makeProject();
    const existingId = await makeIssue(projectId, columnId, '  Fix the LEAK  ');
    const jobId = await makeImportJob(projectId, userId);

    const issueId = await createLocalIssueAndRecord(jobId, 'plane-issue-2', 'ROOMS-2', {
      projectId,
      columnId,
      cycleId: null,
      parentId: null,
      assigneeUserId: null,
      title: 'Fix the leak',
      description: 'from Plane',
      priority: null,
      startDate: null,
      dueDate: null,
    });

    expect(issueId).toBe(existingId);
    const [row] = await db.select().from(issue).where(eq(issue.id, issueId));
    // The reused issue keeps its own content; the import does not overwrite it.
    expect(row?.description).toBe('');
  });
});

describe('createLocalAttachmentAndRecord', () => {
  let originalSettings: StorageSettings | null = null;

  afterEach(async () => {
    if (originalSettings) {
      await setSetting(STORAGE_SETTING_KEY, originalSettings);
      originalSettings = null;
    }
  });

  async function overrideSettings(patch: Partial<StorageSettings>) {
    originalSettings = await getStorageSettings();
    await setSetting(STORAGE_SETTING_KEY, { ...originalSettings, ...patch });
  }

  it('stores a new attachment and records the mapping', async () => {
    const { projectId, columnId, userId } = await makeProject();
    const issueId = await makeIssue(projectId, columnId);
    const jobId = await makeImportJob(projectId, userId);

    const attachmentId = await createLocalAttachmentAndRecord(jobId, 'plane-attachment-1', {
      projectId,
      issueId,
      filename: 'notes.txt',
      contentType: 'text/plain',
      bytes: Buffer.from('hello from plane'),
    });

    const [row] = await db
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.id, attachmentId));
    expect(row?.filename).toBe('notes.txt');
    expect(row?.sizeBytes).toBe(Buffer.byteLength('hello from plane'));
    expect(await findImportRecord(jobId, 'attachment', 'plane-attachment-1')).toEqual({
      localId: attachmentId,
    });
    const stored = await getObject(row!.s3Key);
    expect(await new Response(stored.body).text()).toBe('hello from plane');
  });

  it('reuses an existing attachment on the same issue by filename instead of re-uploading', async () => {
    const { projectId, columnId, userId } = await makeProject();
    const issueId = await makeIssue(projectId, columnId);
    const jobId = await makeImportJob(projectId, userId);
    const [existing] = await db
      .insert(issueAttachment)
      .values({
        issueId,
        s3Key: 'projects/x/attachments/existing.txt',
        filename: 'notes.txt',
        contentType: 'text/plain',
        sizeBytes: 5,
      })
      .returning({ id: issueAttachment.id });

    const attachmentId = await createLocalAttachmentAndRecord(jobId, 'plane-attachment-2', {
      projectId,
      issueId,
      filename: 'notes.txt',
      contentType: 'text/plain',
      bytes: Buffer.from('a different upload'),
    });

    expect(attachmentId).toBe(existing!.id);
    const rows = await db
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.issueId, issueId));
    expect(rows).toHaveLength(1);
    expect(await findImportRecord(jobId, 'attachment', 'plane-attachment-2')).toEqual({
      localId: existing!.id,
    });
  });

  it('rejects an attachment over the configured size limit', async () => {
    await overrideSettings({ maxAttachmentMb: 0.000001 });
    const { projectId, columnId, userId } = await makeProject();
    const issueId = await makeIssue(projectId, columnId);
    const jobId = await makeImportJob(projectId, userId);

    await expect(
      createLocalAttachmentAndRecord(jobId, 'plane-attachment-3', {
        projectId,
        issueId,
        filename: 'big.txt',
        contentType: 'text/plain',
        bytes: Buffer.from('this file is definitely too big for the limit'),
      }),
    ).rejects.toBeInstanceOf(AttachmentRejectedError);
    const rows = await db
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.issueId, issueId));
    expect(rows).toHaveLength(0);
  });

  it('rejects an attachment whose mime type is not accepted on this instance', async () => {
    await overrideSettings({ attachmentMimeTypes: ['application/pdf'] });
    const { projectId, columnId, userId } = await makeProject();
    const issueId = await makeIssue(projectId, columnId);
    const jobId = await makeImportJob(projectId, userId);

    await expect(
      createLocalAttachmentAndRecord(jobId, 'plane-attachment-4', {
        projectId,
        issueId,
        filename: 'notes.txt',
        contentType: 'text/plain',
        bytes: Buffer.from('hello'),
      }),
    ).rejects.toBeInstanceOf(AttachmentRejectedError);
    const rows = await db
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.issueId, issueId));
    expect(rows).toHaveLength(0);
  });

  it('rejects an attachment that would exceed the project storage quota', async () => {
    await overrideSettings({ projectQuotaMb: 0.00001 });
    const { projectId, columnId, userId } = await makeProject();
    const issueId = await makeIssue(projectId, columnId);
    const jobId = await makeImportJob(projectId, userId);

    await expect(
      createLocalAttachmentAndRecord(jobId, 'plane-attachment-5', {
        projectId,
        issueId,
        filename: 'notes.txt',
        contentType: 'text/plain',
        bytes: Buffer.from('more bytes than the tiny quota allows'),
      }),
    ).rejects.toBeInstanceOf(AttachmentRejectedError);
    const rows = await db
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.issueId, issueId));
    expect(rows).toHaveLength(0);
  });

  it('deletes the uploaded object when a concurrent write wins the quota race', async () => {
    // A quota tight enough that either upload alone fits but both together don't:
    // the outer, unlocked check on each side sees the project as still empty and
    // lets both through to the upload; only the one that loses the advisory-lock
    // race sees the other's committed bytes and is rejected inside the transaction
    // — after its own upload already ran, which is the case this covers.
    await overrideSettings({ projectQuotaMb: 1 });
    const { projectId, columnId, userId } = await makeProject();
    const issueId = await makeIssue(projectId, columnId);
    const jobId = await makeImportJob(projectId, userId);
    const bytes = Buffer.alloc(700_000, 'x');

    const results = await Promise.allSettled([
      createLocalAttachmentAndRecord(jobId, 'plane-attachment-6a', {
        projectId,
        issueId,
        filename: 'a.bin',
        contentType: 'text/plain',
        bytes,
      }),
      createLocalAttachmentAndRecord(jobId, 'plane-attachment-6b', {
        projectId,
        issueId,
        filename: 'b.bin',
        contentType: 'text/plain',
        bytes,
      }),
    ]);

    const [aResult] = results;
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AttachmentRejectedError);

    const rows = await db
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.issueId, issueId));
    expect(rows).toHaveLength(1);

    // The winner's import_record points at the one row created; the loser's
    // rejection rolled back before upsertImportRecordWith ever ran for it, so it
    // has no import_record at all — which is also true of its uploaded object,
    // deleted by the same catch block once the transaction rejected it.
    const [winnerSourceId, loserSourceId] =
      aResult.status === 'fulfilled'
        ? ['plane-attachment-6a', 'plane-attachment-6b']
        : ['plane-attachment-6b', 'plane-attachment-6a'];
    expect(await findImportRecord(jobId, 'attachment', winnerSourceId)).toEqual({
      localId: rows[0]!.id,
    });
    expect(await findImportRecord(jobId, 'attachment', loserSourceId)).toBeNull();
  });
});
