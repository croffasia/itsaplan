import { beforeEach, expect, test } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';
import type { WeeklyReportSettings } from '../../model';
import { reportDates } from '../../progress';
import { readWeeklyReport, saveWeeklyReport } from '../../service';

beforeEach(resetDb);

async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  const created = await createProject(api, { key: 'PLAN', name: 'Fictional plan' });
  expect(created.status).toBe(201);
  const project = api.projects({ projectKey: 'PLAN' });
  const view = (await project.get()).data!;
  const createType = async (name: string) => (await project['issue-types'].post({ name })).data!.id;
  const levelOneTypeId = view.issueTypes[0].id;
  const levelTwoTypeId = await createType('Milestone');
  const levelThreeTypeId = await createType('Activity');
  const createField = async (name: string, issueTypeId: number, fieldType: 'number' | 'text') =>
    (await project['custom-fields'].post({ name, issueTypeId, fieldType })).data!.id;
  const settings: WeeklyReportSettings = {
    levelOneTypeId,
    levelTwoTypeId,
    levelThreeTypeId,
    levelTwoWeightId: await createField('Milestone weight', levelTwoTypeId, 'number'),
    levelThreeWeightId: await createField('Task weight', levelThreeTypeId, 'number'),
    completionRateId: await createField('Completion rate', levelThreeTypeId, 'number'),
    levelTwoReasonId: await createField('Milestone reason', levelTwoTypeId, 'text'),
    levelThreeReasonId: await createField('Task reason', levelThreeTypeId, 'text'),
    timeZone: 'Asia/Taipei',
  };
  return { owner, api, project, view, settings };
}

test('validates bindings and does not copy their project-local IDs', async () => {
  const { api, project, settings } = await setup();
  const scope = project.settings['weekly-report'];
  expect((await scope.get()).data).toEqual({ settings: null });
  expect((await project['weekly-report'].get()).data).toEqual({ status: 'setup' });
  expect((await scope.put({ ...settings, timeZone: 'Invalid/Zone' })).status).toBe(400);
  expect((await scope.put({ ...settings, levelTwoTypeId: settings.levelOneTypeId })).status).toBe(
    400,
  );
  expect(
    (await scope.put({ ...settings, levelTwoWeightId: settings.levelThreeWeightId })).status,
  ).toBe(400);
  await createProject(api, { key: 'OTHER', name: 'Other' });
  const foreignField = (
    await api
      .projects({ projectKey: 'OTHER' })
      ['custom-fields'].post({ name: 'Weight', fieldType: 'number' })
  ).data!.id;
  expect((await scope.put({ ...settings, levelTwoWeightId: foreignField })).status).toBe(400);
  expect((await scope.put(settings)).status).toBe(200);
  expect((await scope.get()).data).toEqual({ settings });
  expect((await project.copy.post({ key: 'COPY', name: 'Copy' })).status).toBe(201);
  expect((await api.projects({ projectKey: 'COPY' })['weekly-report'].get()).data).toEqual({
    status: 'setup',
  });
});

test('rolls up archived work, reports only open delays, and atomically saves one document per week', async () => {
  const { api, owner, project, view, settings } = await setup();
  const endpoint = project['weekly-report'];
  const now = new Date();
  const today = reportDates(now, settings.timeZone).today;
  const overdue = '2020-01-01';
  const column = (stateType: string) =>
    view.columns.find((item) => item.stateType === stateType)!.id;
  const started = column('started');
  const closed = column('completed');
  const canceled = column('canceled');
  const add = async (
    title: string,
    typeId: number,
    parentId?: number,
    dueDate?: string,
    columnId = started,
  ) => {
    const created = await project.issues.post({ title, typeId, parentId, dueDate, columnId });
    expect(created.status).toBe(201);
    return created.data!.id;
  };
  const field = async (issueId: number, fieldId: number, value: number | string) => {
    expect((await api.issues({ issueId }).fields({ fieldId }).put({ value })).status).toBe(200);
  };
  const root = await add('Fixture module', settings.levelOneTypeId);
  const a = await add('Launch preparation', settings.levelTwoTypeId, root, today);
  const b = await add('Documentation', settings.levelTwoTypeId, root, overdue);
  const leaf = await add('Internal leaf name', settings.levelThreeTypeId, a, overdue);
  const archived = await add(
    'Finished internal task',
    settings.levelThreeTypeId,
    a,
    overdue,
    closed,
  );
  const missing = await add('Awaiting internal review', settings.levelThreeTypeId, b, overdue);
  const dueToday = await add('Due today', settings.levelThreeTypeId, b, today);
  const ignored = await add(
    'Canceled internal task',
    settings.levelThreeTypeId,
    b,
    overdue,
    canceled,
  );
  await field(a, settings.levelTwoWeightId, 60);
  await field(b, settings.levelTwoWeightId, 40);
  await field(b, settings.levelTwoReasonId, 'Review is pending');
  for (const [id, weight, rate] of [
    [leaf, 40, 80],
    [archived, 60, 100],
    [missing, 100, 50],
    [dueToday, 0, 50],
  ]) {
    await field(id, settings.levelThreeWeightId, weight);
    await field(id, settings.completionRateId, rate);
  }
  await field(leaf, settings.levelThreeReasonId, 'Supplier confirmation pending');
  await field(archived, settings.levelThreeReasonId, 'Old completed delay');
  await field(dueToday, settings.levelThreeReasonId, 'Due today only');
  await field(ignored, settings.levelThreeReasonId, 'Canceled delay');
  expect((await api.issues({ issueId: archived }).archive.post()).status).toBe(200);
  expect((await api.issues({ issueId: missing }).patch({ title: 'Awaiting review' })).status).toBe(
    200,
  );
  expect((await project.settings['weekly-report'].put(settings)).status).toBe(200);

  const preview = (await endpoint.get()).data!;
  if (preview.status !== 'preview') throw new Error('Expected a preview');
  expect(preview.groups).toMatchObject([
    {
      id: root,
      progress: 75.2,
      nodes: [
        { id: a, progress: 92, reasons: ['Supplier confirmation pending'] },
        { id: b, progress: 50, reasons: ['Review is pending'] },
      ],
    },
  ]);
  expect(preview.warnings).toEqual([
    { id: missing, title: 'Awaiting review', kind: 'missingReason' },
  ]);
  expect(
    (await api.issues({ issueId: a }).get()).data!.subtasks.map((item) => item.archived),
  ).toContain(true);

  await field(leaf, settings.completionRateId, 101);
  const invalid = (await endpoint.get()).data!;
  if (invalid.status !== 'preview') throw new Error('Expected a preview');
  expect(invalid.groups[0].progress).toBeNull();
  expect(invalid.warnings).toContainEqual({
    id: leaf,
    title: 'Internal leaf name',
    kind: 'invalidRate',
  });
  expect((await endpoint.post({ token: preview.token })).status).toBe(409);
  await field(leaf, settings.completionRateId, 80);

  const outsider = await signUpTestUser();
  expect(
    (await authedApi(outsider.cookie).projects({ projectKey: 'PLAN' })['weekly-report'].get())
      .status,
  ).toBe(403);
  const role = await createRole(api, 'PLAN', {
    name: 'Docs only',
    permissions: { documents: { read: true, create: true } },
  });
  expect(role.status).toBe(201);
  const invitation = (await project.invites.post({ email: outsider.email, role: 'member' })).data!;
  const reader = authedApi(outsider.cookie);
  await reader.invites({ token: invitation.token }).accept.post();
  expect(
    (
      await project
        .members({ userId: outsider.userId })
        .patch({ role: 'member', roleId: role.data!.id })
    ).status,
  ).toBe(204);
  const readerEndpoint = reader.projects({ projectKey: 'PLAN' })['weekly-report'];
  expect((await readerEndpoint.get()).status).toBe(403);
  expect((await readerEndpoint.post({ token: preview.token })).status).toBe(403);

  const saved = await Promise.all([
    endpoint.post({ token: preview.token }),
    endpoint.post({ token: preview.token }),
  ]);
  expect(saved.map((value) => value.status)).toEqual([200, 200]);
  const documentId = saved[0].data!.documentId;
  expect(saved[1].data).toEqual(saved[0].data);
  expect((await readerEndpoint.get()).data).toEqual(saved[0].data);
  expect((await project.documents.get({ query: {} })).data).toHaveLength(1);
  const doc = (await project.documents({ documentId }).get()).data!;
  expect(doc).toMatchObject({ isLocked: true, isPrivate: false, shareToken: null, version: 1 });
  expect(
    (await project.documents({ documentId }).revisions.get()).data?.map(({ version }) => version),
  ).toEqual([1]);
  expect(doc.content).toContain('## Launch preparation\n\nProgress: 92%');
  expect(doc.content).toContain('Supplier confirmation pending');
  expect(doc.content).not.toMatch(
    /Fixture module|Internal leaf name|Old completed delay|Canceled delay|Due today only/,
  );

  await api.issues({ issueId: leaf }).patch({ columnId: closed });
  expect((await endpoint.get()).data).toEqual(saved[0].data);
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000);
  const next = await readWeeklyReport(view.project.id, owner.userId, async () => {}, nextWeek);
  if (next.status !== 'preview') throw new Error('Expected next week preview');
  expect(next.groups[0].nodes[0].reasons).toEqual([]);
  const nextSaved = await saveWeeklyReport(view.project.id, owner.userId, next.token, nextWeek);
  expect(nextSaved.documentId).not.toBe(documentId);
  await expect(
    saveWeeklyReport(view.project.id, owner.userId, preview.token, nextWeek),
  ).rejects.toMatchObject({ status: 409 });
  expect((await project.documents({ documentId }).get()).data?.content).toBe(doc.content);
  expect(
    (await project.documents({ documentId: nextSaved.documentId }).get()).data?.content,
  ).not.toContain('Supplier confirmation pending');
});
