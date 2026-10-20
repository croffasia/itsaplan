import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, workspace, team, project, projectColumn, issue, importJob, user } from '@repo/db';
import { eq } from 'drizzle-orm';
import { createLocalIssueAndRecord, type ClaimedImportJob } from '../../import-store';
import { runRewrite } from '../../import-worker';

// Each test makes its own team, project and job, like import-store.test.ts. The job
// row is 'paused' so no other test's claimDueImportJobs picks it up; runRewrite is
// called directly with the job as the worker would have claimed it.

interface LinearJob {
  job: ClaimedImportJob;
  columnId: number;
  projectKey: string;
}

async function makeLinearJob(teamKey: string): Promise<LinearJob> {
  const [ws] = await db
    .insert(workspace)
    .values({ name: 'Importers' })
    .returning({ id: workspace.id });
  const [teamRow] = await db
    .insert(team)
    .values({ workspaceId: ws!.id, name: 'Importers' })
    .returning({ id: team.id });
  const projectKey = randomUUID().slice(0, 8);
  const [projectRow] = await db
    .insert(project)
    .values({ teamId: teamRow!.id, key: projectKey, name: 'Imported' })
    .returning({ id: project.id });
  const [columnRow] = await db
    .insert(projectColumn)
    .values({ projectId: projectRow!.id, name: 'Backlog', position: 1 })
    .returning({ id: projectColumn.id });
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: 'Importer', email: `${userId}@example.test` });
  const config = { teamId: 'team-ato', teamKey, projectFilter: 'none', projectId: null };
  const [jobRow] = await db
    .insert(importJob)
    .values({
      projectId: projectRow!.id,
      createdByUserId: userId,
      source: 'linear',
      phase: 'rewrite',
      status: 'paused',
      config,
    })
    .returning({ id: importJob.id });
  return {
    job: {
      id: jobRow!.id,
      projectId: projectRow!.id,
      source: 'linear',
      phase: 'rewrite',
      status: 'paused',
      config,
      cursor: {},
      attempts: 0,
      credentialCiphertext: null,
      credentialIv: null,
      credentialAuthTag: null,
    },
    columnId: columnRow!.id,
    projectKey,
  };
}

async function importIssue(
  { job, columnId }: LinearJob,
  sourceId: string,
  number: number,
  description: string,
): Promise<number> {
  return createLocalIssueAndRecord(job.id, sourceId, String(number), {
    projectId: job.projectId,
    columnId,
    cycleId: null,
    parentId: null,
    assigneeUserId: null,
    title: `Issue ${number}`,
    description,
    priority: null,
    startDate: null,
    dueDate: null,
  });
}

async function issueRow(id: number) {
  const [row] = await db.select().from(issue).where(eq(issue.id, id));
  return row!;
}

describe('runRewrite', () => {
  it("rewrites a mention of another imported issue and keeps the issue's own Linear identifier", async () => {
    const linear = await makeLinearJob('ATO');
    const first = await importIssue(
      linear,
      'issue-505',
      505,
      'Needs ATO-506 first.\n\nImported from Linear: ATO-505',
    );
    const second = await importIssue(linear, 'issue-506', 506, 'Imported from Linear: ATO-506');

    await runRewrite(linear.job);

    const target = await issueRow(second);
    expect((await issueRow(first)).description).toBe(
      `Needs ${linear.projectKey}-${target.sequenceNumber} first.\n\nImported from Linear: ATO-505`,
    );
    expect(target.description).toBe('Imported from Linear: ATO-506');
  });

  it('leaves a mention of an issue that another job imported under the same team key', async () => {
    const other = await makeLinearJob('ATO');
    await importIssue(other, 'issue-12', 12, 'Imported from Linear: ATO-12');
    const linear = await makeLinearJob('ATO');
    const child = await importIssue(
      linear,
      'issue-505',
      505,
      'Parent in Linear: ATO-12\n\nImported from Linear: ATO-505',
    );

    await runRewrite(linear.job);

    expect((await issueRow(child)).description).toBe(
      'Parent in Linear: ATO-12\n\nImported from Linear: ATO-505',
    );
  });

  it('leaves the footer, a mention outside the job and a URL in the Links section alone', async () => {
    const linear = await makeLinearJob('ATO');
    const description = [
      'Blocked by ATO-999.',
      '',
      '## Links',
      '',
      '- [Spec](https://linear.app/acme/issue/ATO-506/the-spec)',
      '',
      'Imported from Linear: ATO-505',
    ].join('\n');
    const first = await importIssue(linear, 'issue-505', 505, description);
    await importIssue(linear, 'issue-506', 506, 'Imported from Linear: ATO-506');

    await runRewrite(linear.job);

    expect((await issueRow(first)).description).toBe(description);
  });
});
