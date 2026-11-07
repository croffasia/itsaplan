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
  importRecord,
  issueLabel,
  issueWatcher,
  issueChecklist,
  issueChecklistItem,
  customField,
  issueFieldValue,
  issueFieldOption,
  customFieldOption,
  projectMember,
  user,
} from '@repo/db';
import { and, eq } from 'drizzle-orm';
import {
  insertDiscoveredIds,
  createLocalIssueAndRecord,
  createLocalComment,
  upsertImportRecord,
  findImportRecord,
  type ClaimedImportJob,
} from '../../import-store';
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
  watcherEmails: [],
  labelSourceIds: [],
  cycleSourceId: null,
  parentSourceId: null,
  priority: null,
  startDate: null,
  dueDate: null,
  customFields: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
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
  | 'listCustomFields'
  | 'listIssues'
  | 'getIssue'
  | 'listIssueRelations'
  | 'listIssueComments'
  | 'listIssueAttachments'
  | 'listIssueChecklists'
>;

function readerWithFlakyComments(): SourceReader {
  let commentReads = 0;
  const reader: CreateReader = {
    listStates: async () => [],
    listLabels: async () => [],
    listCycles: async () => [],
    listCustomFields: async () => [],
    listIssues: async () => ({ items: [ISSUE], cursor: null }),
    getIssue: async () => ISSUE,
    listIssueRelations: async () => [],
    listIssueComments: async () => {
      commentReads += 1;
      if (commentReads === 1) throw new Error('source returned 503');
      return COMMENTS;
    },
    listIssueAttachments: async () => [],
    listIssueChecklists: async () => [],
  };
  return reader as SourceReader;
}

function readerForIssues(issues: CanonicalIssue[]): SourceReader {
  return {
    listStates: async () => [],
    listLabels: async () => [],
    listCycles: async () => [],
    listCustomFields: async () => [],
    listIssues: async () => ({ items: issues, cursor: null }),
    getIssue: async (id) => issues.find((item) => item.sourceId === id)!,
    listIssueRelations: async () => [],
    listIssueComments: async () => COMMENTS,
    listIssueAttachments: async () => [],
    listIssueChecklists: async () => [],
    resolveAttachmentDownload: async () => {
      throw new Error('Create must not download attachments');
    },
  };
}

async function seedMappedIssue(job: ClaimedImportJob): Promise<number> {
  const [column] = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(eq(projectColumn.projectId, job.projectId));
  return createLocalIssueAndRecord(job.id, ISSUE.sourceId, String(ISSUE.sequenceId), {
    projectId: job.projectId,
    columnId: column!.id,
    cycleId: null,
    parentId: null,
    assigneeUserId: null,
    title: 'Locally edited title',
    description: 'Keep local description',
    priority: null,
    startDate: null,
    dueDate: null,
  });
}

async function addProjectMember(projectId: number, email: string): Promise<string> {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: email, email });
  await db.insert(projectMember).values({ projectId, userId, role: 'member' });
  return userId;
}

describe('runCreate', () => {
  it('creates custom fields, checklists, watchers and an archived issue, once across a retry', async () => {
    const job = await makeCreateJob();
    const ada = await addProjectMember(job.projectId, `ada-${job.id}@example.test`);
    const bob = await addProjectMember(job.projectId, `bob-${job.id}@example.test`);
    const archived: CanonicalIssue = {
      ...ISSUE,
      assigneeEmail: `ada-${job.id}@example.test`,
      watcherEmails: [`bob-${job.id}@example.test`, 'stranger@example.test'],
      customFields: [
        { fieldSourceId: 'field-size', value: 'L' },
        { fieldSourceId: 'field-points', value: 3 },
        { fieldSourceId: 'field-missing', value: 'lost' },
      ],
      archivedAt: '2026-01-05T00:00:00Z',
    };
    await insertDiscoveredIds(job.id, 'issue', [archived.sourceId]);
    await insertDiscoveredIds(job.id, 'custom_field', ['field-size', 'field-points']);
    const reader = readerForIssues([archived]);
    reader.listIssueComments = async () => [];
    reader.listCustomFields = async () => [
      { sourceId: 'field-size', name: 'Size', fieldType: 'select', options: ['S', 'L'] },
      { sourceId: 'field-points', name: 'Points', fieldType: 'number', options: [] },
    ];
    reader.listIssueChecklists = async () => [
      {
        sourceId: 'checklist-1',
        title: 'Checklist',
        items: [
          { content: 'First', done: true },
          { content: 'Second', done: false },
        ],
      },
      { sourceId: 'checklist-2', title: 'Checklist', items: [] },
    ];

    await runCreate(job, reader);
    await runCreate(job, reader);

    const [created] = await db.select().from(issue).where(eq(issue.projectId, job.projectId));
    expect(created!.assigneeUserId).toBe(ada);
    expect(created!.archivedAt).toEqual(new Date('2026-01-05T00:00:00Z'));
    const watchers = await db
      .select({ userId: issueWatcher.userId })
      .from(issueWatcher)
      .where(eq(issueWatcher.issueId, created!.id));
    expect(watchers).toEqual([{ userId: bob }]);

    const fields = await db
      .select({ id: customField.id, name: customField.name, fieldType: customField.fieldType })
      .from(customField)
      .where(eq(customField.projectId, job.projectId))
      .orderBy(customField.position);
    expect(fields.map(({ name, fieldType }) => [name, fieldType])).toEqual([
      ['Size', 'select'],
      ['Points', 'number'],
    ]);
    const options = await db
      .select({ value: customFieldOption.value })
      .from(customFieldOption)
      .where(eq(customFieldOption.fieldId, fields[0]!.id))
      .orderBy(customFieldOption.position);
    expect(options.map((o) => o.value)).toEqual(['S', 'L']);
    const [picked] = await db
      .select({ value: customFieldOption.value })
      .from(issueFieldOption)
      .innerJoin(customFieldOption, eq(customFieldOption.id, issueFieldOption.optionId))
      .where(eq(issueFieldOption.issueId, created!.id));
    expect(picked!.value).toBe('L');
    const values = await db
      .select({ valueNumber: issueFieldValue.valueNumber })
      .from(issueFieldValue)
      .where(eq(issueFieldValue.issueId, created!.id));
    expect(values.map((v) => Number(v.valueNumber))).toEqual([3]);

    const checklists = await db
      .select()
      .from(issueChecklist)
      .where(eq(issueChecklist.issueId, created!.id))
      .orderBy(issueChecklist.position);
    expect(checklists.map((c) => c.title)).toEqual(['Checklist', 'Checklist']);
    const items = await db
      .select({ content: issueChecklistItem.content, done: issueChecklistItem.done })
      .from(issueChecklistItem)
      .where(eq(issueChecklistItem.checklistId, checklists[0]!.id))
      .orderBy(issueChecklistItem.position);
    expect(items).toEqual([
      { content: 'First', done: true },
      { content: 'Second', done: false },
    ]);
  });

  it('reuses a field of the same name and type and adds the options it lacks', async () => {
    const job = await makeCreateJob();
    const [existing] = await db
      .insert(customField)
      .values({ projectId: job.projectId, name: 'Size', fieldType: 'select' })
      .returning({ id: customField.id });
    await db.insert(customFieldOption).values({ fieldId: existing!.id, value: 'S' });
    await db
      .insert(customField)
      .values({ projectId: job.projectId, name: 'Points', fieldType: 'text' });
    await insertDiscoveredIds(job.id, 'custom_field', ['field-size', 'field-points']);
    const reader = readerForIssues([]);
    reader.listCustomFields = async () => [
      { sourceId: 'field-size', name: 'Size', fieldType: 'select', options: ['S', 'L'] },
      { sourceId: 'field-points', name: 'Points', fieldType: 'number', options: [] },
    ];

    await runCreate(job, reader);

    expect(await findImportRecord(job.id, 'custom_field', 'field-size')).toEqual({
      localId: existing!.id,
    });
    const options = await db
      .select({ value: customFieldOption.value })
      .from(customFieldOption)
      .where(eq(customFieldOption.fieldId, existing!.id))
      .orderBy(customFieldOption.position);
    expect(options.map((o) => o.value)).toEqual(['S', 'L']);
    const points = await db
      .select({ fieldType: customField.fieldType })
      .from(customField)
      .where(and(eq(customField.projectId, job.projectId), eq(customField.name, 'Points')))
      .orderBy(customField.id);
    expect(points.map((p) => p.fieldType)).toEqual(['text', 'number']);
  });

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

  it('finishes labels, comments and attachment discovery after an issue mapping committed', async () => {
    const job = await makeCreateJob();
    await insertDiscoveredIds(job.id, 'issue', [ISSUE.sourceId]);
    await insertDiscoveredIds(job.id, 'label', ['label-1']);
    const localId = await seedMappedIssue(job);
    const reader = readerForIssues([{ ...ISSUE, labelSourceIds: ['label-1'] }]);
    reader.listLabels = async () => [{ sourceId: 'label-1', name: 'Imported label' }];
    reader.listIssueAttachments = async () => [
      {
        sourceId: 'attachment-1',
        filename: 'note.txt',
        contentType: 'text/plain',
        sizeBytes: 4,
      },
    ];

    await runCreate(job, reader);
    const [savedJob] = await db.select().from(importJob).where(eq(importJob.id, job.id));
    await runCreate({ ...job, cursor: savedJob!.cursor as ClaimedImportJob['cursor'] }, reader);

    const issues = await db.select().from(issue).where(eq(issue.projectId, job.projectId));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe(localId);
    expect(issues[0]!.title).toBe('Locally edited title');
    expect(issues[0]!.description).toBe('Keep local description');
    const labels = await db.select().from(issueLabel).where(eq(issueLabel.issueId, localId));
    expect(labels).toHaveLength(1);
    const comments = await db
      .select()
      .from(issueActivity)
      .where(and(eq(issueActivity.issueId, localId), eq(issueActivity.kind, 'comment')));
    expect(comments.map((comment) => comment.body).sort()).toEqual(['First', 'Second']);
    expect(await findImportRecord(job.id, 'attachment', 'attachment-1')).toEqual({ localId: null });
  });

  it('reuses an unmapped comment after a crash and keeps identical source comments distinct', async () => {
    const job = await makeCreateJob();
    await insertDiscoveredIds(job.id, 'issue', [ISSUE.sourceId]);
    const localId = await seedMappedIssue(job);
    const first = COMMENTS[0]!;
    const firstId = await createLocalComment(
      job.id,
      localId,
      null,
      first.authorName,
      first.bodyMarkdown,
      new Date(first.createdAt),
      null,
    );
    await upsertImportRecord(job.id, 'comment', first.sourceId, 'comment', firstId);
    const unmappedId = await createLocalComment(
      job.id,
      localId,
      null,
      first.authorName,
      first.bodyMarkdown,
      new Date(first.createdAt),
      null,
    );
    const reader = readerForIssues([ISSUE]);
    reader.listIssueComments = async () => [
      first,
      { ...first, sourceId: 'identical-comment' },
      { ...COMMENTS[1]!, replyToSourceId: 'identical-comment' },
    ];

    await runCreate(job, reader);
    const [savedJob] = await db.select().from(importJob).where(eq(importJob.id, job.id));
    await runCreate({ ...job, cursor: savedJob!.cursor as ClaimedImportJob['cursor'] }, reader);

    expect(await findImportRecord(job.id, 'comment', first.sourceId)).toEqual({ localId: firstId });
    expect(await findImportRecord(job.id, 'comment', 'identical-comment')).toEqual({
      localId: unmappedId,
    });
    const comments = await db
      .select()
      .from(issueActivity)
      .where(and(eq(issueActivity.issueId, localId), eq(issueActivity.kind, 'comment')));
    expect(comments).toHaveLength(3);
    expect(comments.find((comment) => comment.body === 'Second')!.replyToId).toBe(unmappedId);
  });

  it('replays an unfinished batch and advances only beyond fully completed batches', async () => {
    const job = await makeCreateJob();
    const issues = Array.from({ length: 16 }, (_, index) => ({
      ...ISSUE,
      sourceId: `batch-${index}`,
      sequenceId: index + 1,
    }));
    await insertDiscoveredIds(
      job.id,
      'issue',
      issues.map((item) => item.sourceId),
    );
    const reader = readerForIssues(issues);
    reader.listIssueComments = async () => [];
    let fail = true;
    const reads: string[] = [];
    reader.getIssue = async (id) => {
      reads.push(id);
      if (id === 'batch-1' && fail) throw new Error('interrupted batch');
      return issues.find((item) => item.sourceId === id)!;
    };
    await expect(runCreate(job, reader)).rejects.toThrow('interrupted batch');
    const [failedJob] = await db.select().from(importJob).where(eq(importJob.id, job.id));
    expect(failedJob!.cursor).toEqual({});
    fail = false;
    reads.length = 0;
    await runCreate(job, reader);
    expect(reads).toHaveLength(15);
    expect(reads[0]).toBe('batch-0');
    const [saved] = await db.select().from(importJob).where(eq(importJob.id, job.id));
    const records = await db
      .select()
      .from(importRecord)
      .where(and(eq(importRecord.importJobId, job.id), eq(importRecord.sourceEntityType, 'issue')))
      .orderBy(importRecord.id);
    expect(saved!.cursor).toEqual({ lastRecordId: records[14]!.id });
    job.cursor = saved!.cursor as ClaimedImportJob['cursor'];
    reads.length = 0;
    await runCreate(job, reader);
    expect(reads).toEqual(['batch-15']);
    const [last] = await db.select().from(importJob).where(eq(importJob.id, job.id));
    job.cursor = last!.cursor as ClaimedImportJob['cursor'];
    await runCreate(job, reader);
    const [finished] = await db.select().from(importJob).where(eq(importJob.id, job.id));
    expect(finished!.phase).toBe('link');
    const imported = await db.select().from(issue).where(eq(issue.projectId, job.projectId));
    expect(imported).toHaveLength(16);
  });
});
