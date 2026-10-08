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
import { and, eq } from 'drizzle-orm';
import { insertDiscoveredIds, type ClaimedImportJob } from '../../import-store';
import { runCreate } from '../../import-worker';
import type { SourceReader } from '../../reader';
import type { CanonicalComment, CanonicalIssue } from '../../canonical';

// Like import-rewrite's tests: the job row is 'paused' so no other test's
// claimDueImportJobs picks it up, and runCreate is called directly with the job
// as the worker would have claimed it.

async function makeCreateJob(): Promise<ClaimedImportJob> {
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
  await db
    .insert(projectColumn)
    .values({ projectId: projectRow!.id, name: 'Backlog', position: 1 });
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: 'Importer', email: `${userId}@example.test` });
  const [jobRow] = await db
    .insert(importJob)
    .values({
      projectId: projectRow!.id,
      createdByUserId: userId,
      source: 'plane',
      phase: 'create',
      status: 'paused',
    })
    .returning({ id: importJob.id });
  return {
    id: jobRow!.id,
    projectId: projectRow!.id,
    source: 'plane',
    phase: 'create',
    status: 'paused',
    config: {},
    cursor: {},
    attempts: 0,
    credentialCiphertext: null,
    credentialIv: null,
    credentialAuthTag: null,
  };
}

const ISSUE: CanonicalIssue = {
  sourceId: 'issue-1',
  sequenceId: 1,
  title: 'Imported issue',
  descriptionMarkdown: '',
  stateSourceId: 'state-1',
  assigneeEmail: null,
  labelSourceIds: [],
  cycleSourceId: null,
  parentSourceId: null,
  priority: null,
  startDate: null,
  dueDate: null,
  customFields: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const COMMENTS: CanonicalComment[] = [
  {
    sourceId: 'comment-1',
    authorEmail: null,
    authorName: 'Ada',
    bodyMarkdown: 'First',
    createdAt: '2026-01-02T00:00:00Z',
    replyToSourceId: null,
  },
  {
    sourceId: 'comment-2',
    authorEmail: null,
    authorName: 'Ada',
    bodyMarkdown: 'Second',
    createdAt: '2026-01-03T00:00:00Z',
    replyToSourceId: null,
  },
];

// Create never resolves a download, so the stub leaves that method out.
type CreateReader = Pick<
  SourceReader,
  | 'listStates'
  | 'listLabels'
  | 'listCycles'
  | 'listIssues'
  | 'getIssue'
  | 'listIssueRelations'
  | 'listIssueComments'
  | 'listIssueAttachments'
>;

function readerWithFlakyComments(): SourceReader {
  let commentReads = 0;
  const reader: CreateReader = {
    listStates: async () => [],
    listLabels: async () => [],
    listCycles: async () => [],
    listIssues: async () => ({ items: [ISSUE], cursor: null }),
    getIssue: async () => ISSUE,
    listIssueRelations: async () => [],
    listIssueComments: async () => {
      commentReads += 1;
      if (commentReads === 1) throw new Error('source returned 503');
      return COMMENTS;
    },
    listIssueAttachments: async () => [],
  };
  return reader as SourceReader;
}

describe('runCreate', () => {
  it("creates an issue's comments on the retry after its comment read failed", async () => {
    const job = await makeCreateJob();
    await insertDiscoveredIds(job.id, 'issue', [ISSUE.sourceId]);
    const reader = readerWithFlakyComments();

    await expect(runCreate(job, reader)).rejects.toThrow('source returned 503');
    await runCreate(job, reader);

    const issues = await db
      .select({ id: issue.id })
      .from(issue)
      .where(eq(issue.projectId, job.projectId));
    expect(issues).toHaveLength(1);
    const comments = await db
      .select({ body: issueActivity.body })
      .from(issueActivity)
      .where(and(eq(issueActivity.issueId, issues[0]!.id), eq(issueActivity.kind, 'comment')));
    expect(comments.map((c) => c.body).sort()).toEqual(['First', 'Second']);
  });
});
