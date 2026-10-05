import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  db,
  workspace,
  team,
  project,
  projectColumn,
  issue,
  issueActivity,
  importJob,
  user,
} from '@repo/db';
import { eq } from 'drizzle-orm';
import {
  createLocalIssueAndRecord,
  createLocalComment,
  findImportRecord,
  upsertImportRecord,
} from '../../import-store';

// Each test makes its own team, project and user, like import-store.test.ts. Jobs are
// 'paused' so no other test's claimDueImportJobs picks them up.

async function makeProject(): Promise<{ projectId: number; columnId: number; userId: string }> {
  const [ws] = await db
    .insert(workspace)
    .values({ name: 'Importers' })
    .returning({ id: workspace.id });
  const [teamRow] = await db
    .insert(team)
    .values({ workspaceId: ws!.id, name: 'Importers' })
    .returning({ id: team.id });
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

async function makeJob(projectId: number, userId: string): Promise<number> {
  const [row] = await db
    .insert(importJob)
    .values({ projectId, createdByUserId: userId, source: 'plane', status: 'paused' })
    .returning({ id: importJob.id });
  return row!.id;
}

function importIssue(
  jobId: number,
  sourceId: string,
  number: number,
  target: { projectId: number; columnId: number },
): Promise<number> {
  return createLocalIssueAndRecord(jobId, sourceId, String(number), {
    projectId: target.projectId,
    columnId: target.columnId,
    cycleId: null,
    parentId: null,
    assigneeUserId: null,
    title: 'Fix the login page',
    description: '',
    priority: null,
    startDate: null,
    dueDate: null,
  });
}

// What the Create phase does for one source comment: create or reuse, then map it.
async function importComment(jobId: number, sourceId: string, issueId: number): Promise<number> {
  const localId = await createLocalComment(
    jobId,
    issueId,
    null,
    'Bot',
    'Deployed.',
    new Date('2025-01-05T10:00:00.000Z'),
    null,
  );
  await upsertImportRecord(jobId, 'comment', sourceId, 'comment', localId);
  return localId;
}

describe('same-titled source issues', () => {
  it('creates one issue per source issue within a job, even when titles match', async () => {
    const target = await makeProject();
    const jobId = await makeJob(target.projectId, target.userId);

    const first = await importIssue(jobId, 'src-1', 1, target);
    const second = await importIssue(jobId, 'src-2', 2, target);

    expect(second).not.toBe(first);
    const rows = await db.select().from(issue).where(eq(issue.projectId, target.projectId));
    expect(rows).toHaveLength(2);
  });

  it('reuses each one in a later job, matched in import order', async () => {
    const target = await makeProject();
    const firstJob = await makeJob(target.projectId, target.userId);
    const first = await importIssue(firstJob, 'src-1', 1, target);
    const second = await importIssue(firstJob, 'src-2', 2, target);
    const rerun = await makeJob(target.projectId, target.userId);

    expect(await importIssue(rerun, 'src-1', 1, target)).toBe(first);
    expect(await importIssue(rerun, 'src-2', 2, target)).toBe(second);
    expect(await findImportRecord(rerun, 'issue', 'src-2')).toEqual({ localId: second });
    const rows = await db.select().from(issue).where(eq(issue.projectId, target.projectId));
    expect(rows).toHaveLength(2);
  });
});

describe('identical source comments', () => {
  it('creates one comment per source comment within a job, even with the same body and time', async () => {
    const target = await makeProject();
    const jobId = await makeJob(target.projectId, target.userId);
    const issueId = await importIssue(jobId, 'src-1', 1, target);

    const first = await importComment(jobId, 'comment-1', issueId);
    const second = await importComment(jobId, 'comment-2', issueId);

    expect(second).not.toBe(first);
    const rows = await db.select().from(issueActivity).where(eq(issueActivity.issueId, issueId));
    expect(rows).toHaveLength(2);
  });

  it('reuses each one in a later job', async () => {
    const target = await makeProject();
    const firstJob = await makeJob(target.projectId, target.userId);
    const issueId = await importIssue(firstJob, 'src-1', 1, target);
    const first = await importComment(firstJob, 'comment-1', issueId);
    const second = await importComment(firstJob, 'comment-2', issueId);
    const rerun = await makeJob(target.projectId, target.userId);
    expect(await importIssue(rerun, 'src-1', 1, target)).toBe(issueId);

    expect(await importComment(rerun, 'comment-1', issueId)).toBe(first);
    expect(await importComment(rerun, 'comment-2', issueId)).toBe(second);
    const rows = await db.select().from(issueActivity).where(eq(issueActivity.issueId, issueId));
    expect(rows).toHaveLength(2);
  });
});
