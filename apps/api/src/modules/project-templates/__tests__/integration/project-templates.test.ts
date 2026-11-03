import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';

async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

async function ownTeamId(api: Api): Promise<number> {
  return (await api.teams.get()).data![0].id;
}

// Signs up a user, invites them into the team on the given rank and accepts for them.
async function addTeamMember(owner: Api, teamId: number, role: 'manager' | 'member') {
  const user = await signUpTestUser();
  const created = await owner.teams({ teamId }).invites.post({ email: user.email, role });
  const api = authedApi(user.cookie);
  await api.invites({ token: created.data!.token }).accept.post();
  return { user, api };
}

// A workspace whose team holds the project SRC, which has the label "bug", saved as the
// template "Kanban".
async function setup() {
  const { user, api } = await signUpClient();
  const workspaceId = user.workspaceId!;
  const teamId = await ownTeamId(api);
  const source = (await createProject(api, { key: 'SRC', name: 'Source' })).data!;
  await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });
  const templates = api.workspaces({ workspaceId })['project-templates'];
  const saved = await templates.post({
    projectId: source.id,
    name: 'Kanban',
    description: 'Our board',
  });
  expect(saved.status).toBe(201);
  return { user, api, workspaceId, teamId, source, templates, template: saved.data! };
}

async function secondTeam(api: Api, workspaceId: number, slug = 'second'): Promise<number> {
  const created = await api.teams.post({ name: 'Second', slug, workspaceId });
  return created.data!.id;
}

describe('project templates', () => {
  beforeEach(resetDb);

  describe('save', () => {
    it('lists the template in the workspace and to every team of it', async () => {
      const { api, workspaceId, teamId, templates, template } = await setup();
      const otherTeamId = await secondTeam(api, workspaceId);
      expect(template).toMatchObject({ name: 'Kanban', description: 'Our board', teamIds: null });

      const list = await templates.get();
      expect(list.status).toBe(200);
      expect(list.data).toMatchObject([{ id: template.id, name: 'Kanban', teamIds: null }]);
      for (const id of [teamId, otherTeamId]) {
        const forTeam = await api.teams({ teamId: id })['project-templates'].get();
        expect(forTeam.data?.map((t) => t.id)).toEqual([template.id]);
      }
      expect((await api.teams.get()).data?.find((t) => t.id === teamId)).toMatchObject({
        projectCount: 1,
      });
    });

    it('keeps what was saved when the project changes or is deleted', async () => {
      const { api, teamId, source, template } = await setup();
      await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'later', color: '#00ff00' });
      await api.teams({ teamId }).projects({ projectId: source.id }).delete();

      const created = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });
      expect(created.status).toBe(201);

      const view = await api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
    });

    it('leaves out the docs and the webhooks', async () => {
      const { api, teamId, source, templates } = await setup();
      const sourceApi = api.projects({ projectKey: 'SRC' });
      await sourceApi.documents.post({ title: 'Runbook' });
      await sourceApi.webhooks.post({ url: 'https://example.com/hook', events: ['issue.created'] });
      const saved = await templates.post({
        projectId: source.id,
        name: 'Everything',
        include: { documents: true, webhooks: true },
      });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

      const created = api.projects({ projectKey: 'NEW' });
      expect((await created.documents.get({ query: {} })).data).toEqual([]);
      expect((await created.webhooks.get()).data).toEqual([]);
    });

    it('saves only the chosen sections', async () => {
      const { api, teamId, source, templates } = await setup();
      const saved = await templates.post({
        projectId: source.id,
        name: 'States only',
        include: { states: true },
      });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

      const view = await api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.labels).toEqual([]);
      expect(view.data?.issueTypes).toEqual([]);
    });

    it('starts on the default columns when the states are left out', async () => {
      const { api, teamId, source, templates } = await setup();
      await api
        .projects({ projectKey: 'SRC' })
        .columns.post({ name: 'Review', stateType: 'started' });
      const saved = await templates.post({
        projectId: source.id,
        name: 'Labels only',
        include: { labels: true },
      });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

      const view = await api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.columns.map((c) => c.name)).toEqual([
        'Backlog',
        'Todo',
        'In Progress',
        'Done',
        'Canceled',
      ]);
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
    });

    it('rejects an empty name and an empty team list', async () => {
      const { source, templates } = await setup();
      expect((await templates.post({ projectId: source.id, name: '' })).status).toBe(400);
      const noTeams = await templates.post({ projectId: source.id, name: 'None', teamIds: [] });
      expect(noTeams.status).toBe(400);
    });

    it('404s for a project of another workspace', async () => {
      const { templates } = await setup();
      const other = await signUpClient();
      const otherProject = (await createProject(other.api, { key: 'OTH', name: 'Other' })).data!;

      const fromOther = await templates.post({ projectId: otherProject.id, name: 'Theirs' });
      expect(fromOther.status).toBe(404);
    });

    it('400s for a team of another workspace', async () => {
      const { source, templates } = await setup();
      const other = await signUpClient();

      const saved = await templates.post({
        projectId: source.id,
        name: 'Theirs',
        teamIds: [await ownTeamId(other.api)],
      });
      expect(saved.status).toBe(400);
    });

    it('is left to the owner and the admins of the workspace', async () => {
      const { api, workspaceId, teamId, source, template } = await setup();
      const manager = await addTeamMember(api, teamId, 'manager');
      const admin = await addTeamMember(api, teamId, 'member');
      await api.workspaces({ workspaceId }).managers.post({ userId: admin.user.userId });

      const asManager = manager.api.workspaces({ workspaceId })['project-templates'];
      expect((await asManager.get()).status).toBe(404);
      expect((await asManager({ templateId: template.id }).get()).status).toBe(404);
      expect((await asManager.post({ projectId: source.id, name: 'Mine' })).status).toBe(404);
      expect((await asManager({ templateId: template.id }).patch({ name: 'Mine' })).status).toBe(
        404,
      );
      expect((await asManager({ templateId: template.id }).delete()).status).toBe(404);

      const saved = await admin.api
        .workspaces({ workspaceId })
        ['project-templates'].post({ projectId: source.id, name: 'Admin' });
      expect(saved.status).toBe(201);
    });
  });

  describe('preview', () => {
    it('shows what a template of the project would hold, saving nothing', async () => {
      const { source, templates } = await setup();

      const full = await templates.preview.post({ projectId: source.id });
      expect(full.status).toBe(200);
      expect(full.data).toMatchObject({
        labels: [{ name: 'bug' }],
        issueTypes: [{ name: 'Task' }],
      });
      const statesOnly = await templates.preview.post({
        projectId: source.id,
        include: { states: true },
      });
      expect(statesOnly.data?.labels).toEqual([]);
      expect(statesOnly.data?.columns.map((c) => c.name)).toContain('Done');
      expect((await templates.get()).data).toHaveLength(1);
    });

    it('404s for a project of another workspace and for someone who does not manage it', async () => {
      const { api, workspaceId, teamId, source, templates } = await setup();
      const other = await signUpClient();
      const otherProject = (await createProject(other.api, { key: 'OTH', name: 'Other' })).data!;
      expect((await templates.preview.post({ projectId: otherProject.id })).status).toBe(404);

      const manager = await addTeamMember(api, teamId, 'manager');
      const asManager = manager.api.workspaces({ workspaceId });
      expect(
        (await asManager['project-templates'].preview.post({ projectId: source.id })).status,
      ).toBe(404);
    });
  });

  describe('teams', () => {
    it('limits a template to the chosen teams', async () => {
      const { api, workspaceId, teamId, source, templates } = await setup();
      const otherTeamId = await secondTeam(api, workspaceId);
      const saved = await templates.post({
        projectId: source.id,
        name: 'First team',
        teamIds: [teamId],
      });
      expect(saved.data).toMatchObject({ teamIds: [teamId] });

      const forOther = await api.teams({ teamId: otherTeamId })['project-templates'].get();
      expect(forOther.data?.map((t) => t.name)).toEqual(['Kanban']);
      const detail = await api
        .teams({ teamId: otherTeamId })
        ['project-templates']({ templateId: saved.data!.id })
        .get();
      expect(detail.status).toBe(404);
      const created = await api
        .teams({ teamId: otherTeamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });
      expect(created.status).toBe(404);

      const own = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });
      expect(own.status).toBe(201);
    });

    it('stays closed to the other teams once its teams are deleted', async () => {
      const { api, workspaceId, teamId, source, templates } = await setup();
      const otherTeamId = await secondTeam(api, workspaceId);
      const saved = await templates.post({
        projectId: source.id,
        name: 'Second team',
        teamIds: [otherTeamId],
      });
      expect((await api.teams({ teamId: otherTeamId }).delete()).status).toBe(204);

      const list = await templates.get();
      expect(list.data?.find((t) => t.id === saved.data!.id)).toMatchObject({ teamIds: [] });
      const forTeam = await api.teams({ teamId })['project-templates'].get();
      expect(forTeam.data?.map((t) => t.name)).toEqual(['Kanban']);
    });
  });

  describe('detail', () => {
    it('shows what the template holds', async () => {
      const { api, teamId, templates, template } = await setup();

      for (const detail of [
        await templates({ templateId: template.id }).get(),
        await api.teams({ teamId })['project-templates']({ templateId: template.id }).get(),
      ]) {
        expect(detail.status).toBe(200);
        expect(detail.data).toMatchObject({
          id: template.id,
          name: 'Kanban',
          description: 'Our board',
          teamIds: null,
          labels: [{ name: 'bug' }],
          issueTypes: [{ name: 'Task' }],
          estimates: { points: false, time: false, logging: false },
          sections: [],
        });
        expect(detail.data?.columns.map((c) => c.name)).toEqual([
          'Backlog',
          'Todo',
          'In Progress',
          'Done',
          'Canceled',
        ]);
      }
    });

    it('404s for a template of another workspace', async () => {
      const { api, teamId, templates } = await setup();
      const other = await setup();

      expect((await templates({ templateId: other.template.id }).get()).status).toBe(404);
      const forTeam = await api
        .teams({ teamId })
        ['project-templates']({ templateId: other.template.id })
        .get();
      expect(forTeam.status).toBe(404);
    });

    it('is read by the owners and managers of a team, not by its members', async () => {
      const { api, teamId, template } = await setup();
      const member = await addTeamMember(api, teamId, 'member');
      const manager = await addTeamMember(api, teamId, 'manager');

      const asMember = member.api.teams({ teamId })['project-templates'];
      expect((await asMember.get()).status).toBe(403);
      expect((await asMember({ templateId: template.id }).get()).status).toBe(403);

      const asManager = manager.api.teams({ teamId })['project-templates'];
      expect((await asManager.get()).data?.map((t) => t.id)).toEqual([template.id]);
    });
  });

  describe('create a project from a template', () => {
    it('takes what the template holds and the default agents', async () => {
      const { api, teamId, template } = await setup();
      const agent = (
        await createAgent(api, 'SRC', { name: 'Triage', username: 'triage', kind: 'external' })
      ).data!.agent;
      await api.teams({ teamId })['project-defaults'].patch({ defaultAgentIds: [agent.id] });

      const created = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ key: 'NEW', name: 'New', teamId });

      const view = (await api.projects({ projectKey: 'NEW' }).get()).data!;
      expect(view.viewer.role).toBe('owner');
      expect(view.labels.map((l) => l.name)).toEqual(['bug']);
      const members = await api.projects({ projectKey: 'NEW' }).members.get();
      expect(members.data?.items.map((m) => m.userId)).toContain(agent.userId);
    });

    it('creates the project in another team of the workspace', async () => {
      const { api, workspaceId, template } = await setup();
      const otherTeamId = await secondTeam(api, workspaceId);

      const created = await api
        .teams({ teamId: otherTeamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ teamId: otherTeamId });

      const view = await api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
    });

    it('remaps what views and issue templates reference onto the new project', async () => {
      const { api, teamId, source, templates } = await setup();
      const sourceView = (await api.projects({ projectKey: 'SRC' }).get()).data!;
      const bug = sourceView.labels[0];
      const done = sourceView.columns.find((c) => c.name === 'Done')!;
      await api.projects({ projectKey: 'SRC' }).views.post({
        name: 'Bugs',
        filters: { conditions: [{ field: 'labels', op: 'any', values: [bug.id] }] },
      });
      await api.projects({ projectKey: 'SRC' })['issue-templates'].post({
        name: 'Bug report',
        columnId: done.id,
        labelIds: [bug.id],
      });
      const saved = await templates.post({ projectId: source.id, name: 'Views' });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

      const created = (await api.projects({ projectKey: 'NEW' }).get()).data!;
      const newBug = created.labels.find((l) => l.name === 'bug')!;
      const newDone = created.columns.find((c) => c.name === 'Done')!;
      const views = (await api.projects({ projectKey: 'NEW' }).views.get()).data!;
      expect(views.find((v) => v.name === 'Bugs')?.filters).toEqual({
        conditions: [{ id: '1', field: 'labels', op: 'any', values: [newBug.id] }],
      });
      const issueTemplates = (await api.projects({ projectKey: 'NEW' })['issue-templates'].get())
        .data!;
      expect(issueTemplates).toMatchObject([
        { name: 'Bug report', columnId: newDone.id, labelIds: [newBug.id] },
      ]);
    });

    it('remaps the groups, the widgets and the actions onto the new project', async () => {
      const { api, teamId, source, templates } = await setup();
      const src = api.projects({ projectKey: 'SRC' });
      const done = (await src.get()).data!.columns.find((c) => c.name === 'Done')!;
      const size = (await src['custom-fields'].post({ name: 'Size', fieldType: 'select' })).data!;
      await src.views.post({
        name: 'Board',
        display: {
          group: `cf:${size.id}`,
          collapsedGroups: [`c${done.id}`, 'i7'],
          pinnedGroup: `c${done.id}`,
        },
      });
      const status = { conditions: [{ id: 'q', field: 'status', op: 'is', values: [done.id] }] };
      await src.dashboards.post({
        name: 'Overview',
        layout: [{ id: 'w', type: 'recent_issues', config: { filters: status, initiativeId: 7 } }],
      });
      await src.actions.post({ name: 'Close', effect: { columnId: done.id } });
      const saved = await templates.post({ projectId: source.id, name: 'Board' });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

      const created = api.projects({ projectKey: 'NEW' });
      const project = (await created.get()).data!;
      const newDone = project.columns.find((c) => c.name === 'Done')!;
      const newSize = project.customFields.find((f) => f.name === 'Size')!;
      const view = (await created.views.get()).data!.find((v) => v.name === 'Board')!;
      expect(view.display).toMatchObject({
        group: `cf:${newSize.id}`,
        collapsedGroups: [`c${newDone.id}`, 'i7'],
        pinnedGroup: `c${newDone.id}`,
      });
      expect((await created.dashboards.get()).data![0].layout).toEqual([
        {
          id: '1',
          type: 'recent_issues',
          config: {
            filters: { conditions: [{ id: '1', field: 'status', op: 'is', values: [newDone.id] }] },
            initiativeId: 7,
          },
        },
      ]);
      expect((await created.actions.get()).data![0].effect).toEqual({ columnId: newDone.id });
    });

    it('404s for a template of another workspace', async () => {
      const { api, teamId } = await setup();
      const other = await setup();

      const fromOther = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: other.template.id });
      expect(fromOther.status).toBe(404);
    });
  });

  describe('update', () => {
    it('renames the template and changes its description, keeping what it holds', async () => {
      const { api, teamId, templates, template } = await setup();

      const updated = await templates({ templateId: template.id }).patch({
        name: 'Board',
        description: 'Renamed',
      });
      expect(updated.status).toBe(200);
      expect(updated.data).toMatchObject({ name: 'Board', description: 'Renamed', teamIds: null });

      const detail = await templates({ templateId: template.id }).get();
      expect(detail.data).toMatchObject({ name: 'Board', labels: [{ name: 'bug' }] });
      const created = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });
      expect(created.status).toBe(201);
    });

    it('limits the template to teams and opens it to every team again', async () => {
      const { api, workspaceId, teamId, templates, template } = await setup();
      const otherTeamId = await secondTeam(api, workspaceId);
      const forOther = () => api.teams({ teamId: otherTeamId })['project-templates'].get();

      const limited = await templates({ templateId: template.id }).patch({
        teamIds: [teamId, teamId],
      });
      expect(limited.data).toMatchObject({ name: 'Kanban', teamIds: [teamId] });
      expect((await forOther()).data).toEqual([]);

      const moved = await templates({ templateId: template.id }).patch({ teamIds: [otherTeamId] });
      expect(moved.data).toMatchObject({ teamIds: [otherTeamId] });
      expect((await api.teams({ teamId })['project-templates'].get()).data).toEqual([]);

      const opened = await templates({ templateId: template.id }).patch({ teamIds: null });
      expect(opened.data).toMatchObject({ teamIds: null });
      expect((await forOther()).data?.map((t) => t.id)).toEqual([template.id]);
    });

    it('rejects an empty name, an empty team list and an empty body', async () => {
      const { templates, template } = await setup();
      const one = templates({ templateId: template.id });
      expect((await one.patch({ name: '' })).status).toBe(400);
      expect((await one.patch({ teamIds: [] })).status).toBe(400);
      expect((await one.patch({})).status).toBe(400);
      expect((await one.get()).data).toMatchObject({ name: 'Kanban', teamIds: null });
    });

    it('400s for a team of another workspace', async () => {
      const { templates, template } = await setup();
      const other = await signUpClient();

      const updated = await templates({ templateId: template.id }).patch({
        teamIds: [await ownTeamId(other.api)],
      });
      expect(updated.status).toBe(400);
      expect((await templates({ templateId: template.id }).get()).data?.teamIds).toBeNull();
    });

    it('404s for a template of another workspace, leaving it as it was', async () => {
      const { templates } = await setup();
      const other = await setup();

      const updated = await templates({ templateId: other.template.id }).patch({ name: 'Mine' });
      expect(updated.status).toBe(404);
      expect((await other.templates.get()).data).toMatchObject([{ name: 'Kanban' }]);
    });
  });

  describe('share', () => {
    // A view and an action of SRC that name the user, saved with the label as "Shared".
    async function exported() {
      const ctx = await setup();
      const { user, api, source, templates } = ctx;
      const src = api.projects({ projectKey: 'SRC' });
      await src.views.post({
        name: 'Mine',
        filters: {
          conditions: [
            { id: 'c1', field: 'assignee', op: 'is', values: [user.userId, null] },
            { id: 'c2', field: 'delegate', op: 'is', values: [user.userId] },
            { id: 'c3', field: 'priority', op: 'is', values: ['high'] },
          ],
        },
        display: { hiddenGroups: [`a${user.userId}`, 'a-none', 'all'] },
      });
      await src.actions.post({
        name: 'Take',
        condition: {
          conditions: [{ id: 'c1', field: 'assignee', op: 'is', values: [user.userId] }],
        },
        effect: { assigneeUserId: user.userId, priority: 'high' },
      });
      const saved = await templates.post({ projectId: source.id, name: 'Shared' });
      const doc = await templates({ templateId: saved.data!.id }).export.get();
      expect(doc.status).toBe(200);
      return { ...ctx, doc: doc.data! };
    }

    it('exports the template without the people it names', async () => {
      const { user, doc } = await exported();

      expect(doc).toMatchObject({
        format: 'itsaplan.project-template',
        version: 1,
        name: 'Shared',
      });
      expect(doc.snapshot.labels.map((l) => l.name)).toEqual(['bug']);
      expect(doc.snapshot.views[0].filters.conditions).toEqual([
        { id: '1', field: 'assignee', op: 'is', values: [null] },
        { id: '2', field: 'priority', op: 'is', values: ['high'] },
      ]);
      expect(doc.snapshot.views[0].display.hiddenGroups).toEqual(['a-none', 'all']);
      expect(doc.snapshot.actions[0].condition.conditions).toEqual([]);
      expect(doc.snapshot.actions[0].effect).toEqual({ priority: 'high' });
      expect(JSON.stringify(doc)).not.toContain(user.userId);
    });

    it('numbers the parts from 1 and points every reference at those numbers', async () => {
      const { user, api, templates } = await setup();
      const src = api.projects({ projectKey: 'SRC' });
      await src['custom-fields'].post({ name: 'Other', fieldType: 'select', options: ['X'] });
      const numbered = (await createProject(api, { key: 'NUM', name: 'Numbered' })).data!;
      const project = api.projects({ projectKey: 'NUM' });
      const bug = (await project.labels.post({ name: 'bug', color: '#ff0000' })).data!;
      const size = (
        await project['custom-fields'].post({
          name: 'Size',
          fieldType: 'select',
          options: ['S', 'L'],
        })
      ).data!;
      const large = size.options.find((option) => option.value === 'L')!;
      const done = (await project.get()).data!.columns.find((c) => c.name === 'Done')!;
      await project.views.post({
        name: 'Large bugs',
        filters: {
          conditions: [
            { id: 'x', field: 'labels', op: 'is', values: [bug.id] },
            { id: 'y', field: `cf:${size.id}`, op: 'is', values: [large.id] },
            { id: 'z', field: 'initiative', op: 'is', values: [7, 'status:active'] },
          ],
        },
        display: {
          group: `cf:${size.id}`,
          subgroup: `cf:${size.id}`,
          properties: ['id', `cf:${size.id}`],
          calendarDateField: `cf:${size.id}`,
          hiddenGroups: [`c${done.id}`, 'i7'],
          collapsedGroups: [`c${done.id}`, `a${user.userId}`],
          pinnedGroup: `c${done.id}`,
        },
      });
      await project['issue-templates'].post({
        name: 'Bug report',
        columnId: done.id,
        labelIds: [bug.id],
      });
      await project.dashboards.post({
        name: 'Overview',
        layout: [
          {
            id: 'w-abc',
            type: 'recent_issues',
            config: {
              filters: { conditions: [{ id: 'q', field: 'status', op: 'is', values: [done.id] }] },
              actorUserId: user.userId,
              initiativeId: 7,
            },
          },
        ],
      });
      await project.actions.post({
        name: 'Close',
        effect: { columnId: done.id, labelIds: [bug.id] },
      });
      const saved = await templates.post({ projectId: numbered.id, name: 'Numbered' });

      const doc = (await templates({ templateId: saved.data!.id }).export.get()).data!;
      const { snapshot } = doc;
      const doneNumber = snapshot.columns.findIndex((c) => c.name === 'Done') + 1;
      // The rows' own ids differ from the numbers the file gives them.
      expect(done.id).not.toBe(doneNumber);
      expect(bug.id).not.toBe(1);
      expect(size.id).not.toBe(1);
      expect(large.id).not.toBe(2);
      expect(snapshot.columns.map((c) => c.id)).toEqual(snapshot.columns.map((_, i) => i + 1));
      expect(snapshot.labels).toMatchObject([{ id: 1, name: 'bug' }]);
      expect(snapshot.customFields).toMatchObject([
        {
          id: 1,
          name: 'Size',
          options: [
            { id: 1, value: 'S' },
            { id: 2, value: 'L' },
          ],
        },
      ]);
      expect(snapshot.views[0].filters.conditions).toEqual([
        { id: '1', field: 'labels', op: 'is', values: [1] },
        { id: '2', field: 'cf:1', op: 'is', values: [2] },
        { id: '3', field: 'initiative', op: 'is', values: ['status:active'] },
      ]);
      expect(snapshot.views[0].display).toEqual({
        group: 'cf:1',
        subgroup: 'cf:1',
        properties: ['id', 'cf:1'],
        calendarDateField: 'cf:1',
        hiddenGroups: [`c${doneNumber}`],
        collapsedGroups: [`c${doneNumber}`],
        pinnedGroup: `c${doneNumber}`,
      });
      expect(snapshot.issueTemplates).toMatchObject([{ columnId: doneNumber, labelIds: [1] }]);
      expect(snapshot.dashboards[0].layout).toEqual([
        {
          id: '1',
          type: 'recent_issues',
          config: {
            filters: { conditions: [{ id: '1', field: 'status', op: 'is', values: [doneNumber] }] },
          },
        },
      ]);
      expect(snapshot.actions[0].effect).toEqual({ columnId: doneNumber, labelIds: [1] });

      const other = await signUpClient();
      const theirs = other.api.workspaces({ workspaceId: other.user.workspaceId! })[
        'project-templates'
      ];
      const imported = await theirs.import.post({ template: doc, name: 'Theirs' });
      await other.api
        .teams({ teamId: await ownTeamId(other.api) })
        .projects.post({ key: 'NEW', name: 'New', templateId: imported.data!.id });
      const created = other.api.projects({ projectKey: 'NEW' });
      const newProject = (await created.get()).data!;
      const newBug = newProject.labels.find((l) => l.name === 'bug')!;
      const newLarge = newProject.customFields[0].options.find((o) => o.value === 'L')!;
      const view = (await created.views.get()).data!.find((v) => v.name === 'Large bugs')!;
      expect(view.filters.conditions).toEqual([
        { id: '1', field: 'labels', op: 'is', values: [newBug.id] },
        { id: '2', field: `cf:${newProject.customFields[0].id}`, op: 'is', values: [newLarge.id] },
        { id: '3', field: 'initiative', op: 'is', values: ['status:active'] },
      ]);
    });

    it('refuses a template that names a part it does not hold', async () => {
      const { doc, templates } = await exported();
      const view = {
        ...doc.snapshot.views[0],
        filters: { conditions: [{ id: '1', field: 'status', op: 'is', values: [99] }] },
      };
      const label = { ...doc.snapshot.labels[0], groupId: 99 };
      const cases: [typeof doc.snapshot, string][] = [
        [{ ...doc.snapshot, views: [view] }, 'The template has no state 99'],
        [{ ...doc.snapshot, labels: [label] }, 'The template has no label group 99'],
      ];
      for (const [snapshot, error] of cases) {
        const imported = await templates.import.post({
          template: { ...doc, snapshot },
          name: 'Pasted',
        });
        expect(imported.status).toBe(400);
        expect(imported.error?.value).toMatchObject({ error });
      }
      expect((await templates.get()).data?.map((t) => t.name)).toEqual(['Kanban', 'Shared']);
    });

    it('imports an exported template into another workspace', async () => {
      const { doc } = await exported();
      const other = await signUpClient();
      const theirs = other.api.workspaces({ workspaceId: other.user.workspaceId! })[
        'project-templates'
      ];

      const preview = await theirs.import.preview.post({ template: doc });
      expect(preview.status).toBe(200);
      expect(preview.data).toMatchObject({ labels: [{ name: 'bug' }], views: [{ name: 'Mine' }] });

      const imported = await theirs.import.post({ template: doc, name: 'Theirs' });
      expect(imported.status).toBe(201);
      expect(imported.data).toMatchObject({ name: 'Theirs', description: '', teamIds: null });
      const created = await other.api
        .teams({ teamId: await ownTeamId(other.api) })
        .projects.post({ key: 'NEW', name: 'New', templateId: imported.data!.id });
      expect(created.status).toBe(201);
      const view = await other.api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
    });

    it('drops the people a pasted template names', async () => {
      const { doc, templates } = await exported();
      const action = { ...doc.snapshot.actions[0], effect: { assigneeUserId: 'someone' } };
      const pasted = { ...doc, snapshot: { ...doc.snapshot, actions: [action] } };

      const imported = await templates.import.post({ template: pasted, name: 'Pasted' });
      expect(imported.status).toBe(201);
      const again = await templates({ templateId: imported.data!.id }).export.get();
      expect(again.data?.snapshot.actions[0].effect).toEqual({});
    });

    it('refuses a template that is not one or is damaged', async () => {
      const { doc, templates } = await exported();
      const { snapshot } = doc;
      const column = snapshot.columns[0];
      const damaged: unknown[] = [
        { ...doc, format: 'other' },
        { ...doc, version: 2 },
        { ...doc, snapshot: { ...snapshot, columns: [column, { ...column, id: column.id + 1 }] } },
        {
          ...doc,
          snapshot: {
            ...snapshot,
            issueTemplates: [
              {
                name: 'Bug report',
                description: '',
                titleTemplate: '',
                descriptionTemplate: '',
                typeId: null,
                columnId: null,
                priority: null,
                labelIds: [snapshot.labels[0].id, snapshot.labels[0].id],
              },
            ],
          },
        },
        {
          ...doc,
          snapshot: {
            ...snapshot,
            labels: [...snapshot.labels, { ...snapshot.labels[0], name: 'other' }],
          },
        },
        {
          ...doc,
          snapshot: {
            ...snapshot,
            settings: [{ key: 'auto_archive', value: { completedDays: 1e9, canceledDays: null } }],
          },
        },
        { ...doc, snapshot: { ...snapshot, settings: [{ key: 'git', value: {} }] } },
        {
          ...doc,
          snapshot: {
            ...snapshot,
            issueTypes: [
              { ...snapshot.issueTypes[0], isDefault: true },
              { ...snapshot.issueTypes[0], id: 1_000_000, name: 'Other', isDefault: true },
            ],
          },
        },
      ];
      for (const [index, template] of damaged.entries()) {
        const preview = await templates.import.preview.post({ template: template as typeof doc });
        const imported = await templates.import.post({
          template: template as typeof doc,
          name: 'Damaged',
        });
        expect({ index, preview: preview.status, imported: imported.status }).toEqual({
          index,
          preview: 400,
          imported: 400,
        });
      }
      expect((await templates.get()).data?.map((t) => t.name)).toEqual(['Kanban', 'Shared']);
    });

    it('drops a key the template does not list', async () => {
      const { api, teamId, source, doc, templates } = await exported();
      const other = await signUpClient();
      const pasted = {
        ...doc,
        snapshot: {
          ...doc.snapshot,
          flags: { ...doc.snapshot.flags, teamId: await ownTeamId(other.api) },
          columns: doc.snapshot.columns.map((column) => ({ ...column, projectId: source.id })),
        },
      };

      const imported = await templates.import.post({ template: pasted, name: 'Pasted' });
      expect(imported.status).toBe(201);
      const created = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: imported.data!.id });
      expect(created.data).toMatchObject({ teamId });
      const columns = (await api.projects({ projectKey: 'NEW' }).get()).data?.columns;
      expect(columns?.map((c) => c.name)).toEqual(doc.snapshot.columns.map((c) => c.name));
      const sourceColumns = (await api.projects({ projectKey: 'SRC' }).get()).data?.columns;
      expect(sourceColumns).toHaveLength(doc.snapshot.columns.length);
    });

    it('is left to the owner and the admins of the workspace', async () => {
      const { api, workspaceId, teamId, templates, doc } = await exported();
      const shared = (await templates.get()).data!.find((t) => t.name === 'Shared')!;
      const manager = await addTeamMember(api, teamId, 'manager');
      const asManager = manager.api.workspaces({ workspaceId })['project-templates'];

      expect((await asManager({ templateId: shared.id }).export.get()).status).toBe(404);
      expect((await asManager.import.preview.post({ template: doc })).status).toBe(404);
      expect((await asManager.import.post({ template: doc, name: 'Mine' })).status).toBe(404);
    });
  });

  describe('gallery', () => {
    // The gallery at itsaplan.dev, answered here: it emails 123456 as every code.
    const realFetch = globalThis.fetch;
    let gallery: {
      down: boolean;
      codes: string[];
      keys: Set<string>;
      author: { name: string; url: string | null };
      pages: Map<string, { template: { name: string } }>;
    };

    beforeEach(() => {
      gallery = {
        down: false,
        codes: [],
        keys: new Set(),
        author: { name: '', url: null },
        pages: new Map(),
      };
      let next = 0;
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.origin !== 'https://templates.itsaplan.dev') return realFetch(input, init);
        if (gallery.down) throw new TypeError('fetch failed');
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const key = String(new Headers(init?.headers).get('authorization')).slice(7);
        const route = `${init?.method} ${url.pathname.replace(/[A-Za-z0-9]{10}$/, ':id')}`;
        const id = url.pathname.split('/').pop()!;
        const refuse = (status: number, error: string) => Response.json({ error }, { status });
        switch (route) {
          case 'POST /v1/publishers/code':
            gallery.codes.push(body.email);
            return new Response(null, { status: 204 });
          case 'POST /v1/publishers/verify': {
            if (body.code !== '123456') return refuse(400, 'The code is wrong');
            const issued = `tpk_${++next}`;
            gallery.keys.add(issued);
            return Response.json({ key: issued, author: gallery.author });
          }
        }
        if (!gallery.keys.has(key)) return refuse(401, 'Unknown key');
        if (route === 'PUT /v1/publishers/me') {
          gallery.author = { name: body.name, url: body.url ?? null };
          return Response.json({ author: gallery.author });
        }
        if (!gallery.author.name) return refuse(400, 'Name the author before publishing');
        if (route === 'POST /v1/templates') {
          const page = `page${String(++next).padStart(6, '0')}`;
          gallery.pages.set(page, body);
          return Response.json(
            { id: page, url: `https://itsaplan.dev/templates/${page}` },
            { status: 201 },
          );
        }
        if (!gallery.pages.has(id)) return refuse(404, 'Not found');
        if (route === 'PUT /v1/templates/:id') {
          gallery.pages.set(id, body);
          return Response.json({ id, url: `https://itsaplan.dev/templates/${id}` });
        }
        gallery.pages.delete(id);
        return new Response(null, { status: 204 });
      }) as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    // A workspace linked to an address whose author is Ann.
    async function linked() {
      const ctx = await setup();
      const publisher = ctx.api.workspaces({ workspaceId: ctx.workspaceId })['template-publisher'];
      await publisher.code.post({ email: 'Ann@Example.com' });
      const link = await publisher.post({ email: 'ann@example.com', code: '123456' });
      expect(link.status).toBe(200);
      expect((await publisher.author.put({ authorName: 'Ann' })).status).toBe(200);
      return { ...ctx, publisher, one: ctx.templates({ templateId: ctx.template.id }) };
    }

    it('links the workspace with the emailed code', async () => {
      const { api, workspaceId, templates, template } = await setup();
      const publisher = api.workspaces({ workspaceId })['template-publisher'];
      expect((await publisher.get()).data?.publisher).toBeNull();
      const one = templates({ templateId: template.id });
      expect((await one.publication.post()).status).toBe(409);
      expect((await publisher.author.put({ authorName: 'Ann' })).status).toBe(409);

      expect((await publisher.code.post({ email: 'ann@example.com' })).status).toBe(204);
      expect(gallery.codes).toEqual(['ann@example.com']);
      expect((await publisher.code.post({ email: 'not an email' })).status).toBe(400);
      expect((await publisher.post({ email: 'ann@example.com', code: '000000' })).status).toBe(400);
      expect((await publisher.post({ email: 'ann@example.com', code: '12ab56' })).status).toBe(400);

      const link = await publisher.post({ email: 'Ann@Example.com', code: '123456' });
      expect(link.data).toEqual({ email: 'ann@example.com', authorName: '', authorUrl: null });
      expect((await publisher.get()).data?.publisher).toMatchObject({ email: 'ann@example.com' });

      expect((await publisher.delete()).status).toBe(204);
      expect((await publisher.get()).data?.publisher).toBeNull();
    });

    it('names one author for every template of the address', async () => {
      const { api, workspaceId, templates, template } = await setup();
      const publisher = api.workspaces({ workspaceId })['template-publisher'];
      await publisher.code.post({ email: 'ann@example.com' });
      await publisher.post({ email: 'ann@example.com', code: '123456' });
      const one = templates({ templateId: template.id });
      expect((await one.publication.post()).status).toBe(409);

      const named = await publisher.author.put({
        authorName: ' Ann ',
        authorUrl: 'https://x.com/ann',
      });
      expect(named.data).toEqual({
        email: 'ann@example.com',
        authorName: 'Ann',
        authorUrl: 'https://x.com/ann',
      });
      expect(gallery.author).toEqual({ name: 'Ann', url: 'https://x.com/ann' });
      expect((await one.publication.post()).status).toBe(200);

      // Another workspace linking the same address shows the author the gallery keeps.
      const relinked = await publisher.post({ email: 'ann@example.com', code: '123456' });
      expect(relinked.data).toMatchObject({ authorName: 'Ann', authorUrl: 'https://x.com/ann' });
    });

    it('publishes the template without the people it names, and updates its page', async () => {
      const { user, api, source, templates } = await linked();
      await api.projects({ projectKey: 'SRC' }).actions.post({
        name: 'Take',
        effect: { assigneeUserId: user.userId },
      });
      const saved = await templates.post({ projectId: source.id, name: 'Public' });
      const one = templates({ templateId: saved.data!.id });

      const published = await one.publication.post();
      expect(published.status).toBe(200);
      const url = published.data!.url;
      const [page] = [...gallery.pages.values()];
      expect(page).toEqual({
        template: expect.objectContaining({ format: 'itsaplan.project-template', name: 'Public' }),
      });
      expect(JSON.stringify(page)).not.toContain(user.userId);
      const list = (await templates.get()).data!;
      expect(list.find((t) => t.name === 'Public')?.publication).toMatchObject({ url });
      expect(list.find((t) => t.name === 'Kanban')?.publication).toBeNull();

      await one.patch({ name: 'Renamed' });
      const again = await one.publication.post();
      expect(again.data?.url).toBe(url);
      expect(gallery.pages.size).toBe(1);
      expect([...gallery.pages.values()][0]).toMatchObject({ template: { name: 'Renamed' } });
    });

    it('checks the author', async () => {
      const { publisher } = await linked();
      for (const body of [
        { authorName: '' },
        { authorName: '   ' },
        { authorName: 'x'.repeat(81) },
        { authorName: 'Ann', authorUrl: 'http://x.com/ann' },
      ]) {
        expect((await publisher.author.put(body)).status).toBe(400);
      }
      expect((await publisher.author.put({ authorName: 'x'.repeat(80) })).status).toBe(200);
    });

    it('unpublishes, and takes the page down before deleting the template', async () => {
      const { templates, one } = await linked();
      await one.publication.post();
      expect((await one.publication.delete()).status).toBe(204);
      expect(gallery.pages.size).toBe(0);
      expect((await templates.get()).data?.[0].publication).toBeNull();
      expect((await one.publication.delete()).status).toBe(204);

      await one.publication.post();
      gallery.down = true;
      expect((await one.delete()).status).toBe(502);
      expect((await templates.get()).data).toHaveLength(1);
      gallery.down = false;
      expect((await one.delete()).status).toBe(204);
      expect(gallery.pages.size).toBe(0);
    });

    it('publishes again when the gallery no longer holds the page', async () => {
      const { one } = await linked();
      const first = (await one.publication.post()).data!.url;
      gallery.pages.clear();
      const second = await one.publication.post();
      expect(second.data?.url).not.toBe(first);
      expect(gallery.pages.size).toBe(1);
    });

    it('asks to link again once the gallery refuses the key', async () => {
      const { one, publisher } = await linked();
      gallery.keys.clear();
      expect((await one.publication.post()).status).toBe(409);
      expect((await publisher.author.put({ authorName: 'Ann' })).status).toBe(409);
    });

    it('is left to the owner and the admins of the workspace', async () => {
      const { api, workspaceId, teamId, template } = await linked();
      const manager = await addTeamMember(api, teamId, 'manager');
      const theirs = manager.api.workspaces({ workspaceId });

      expect((await theirs['template-publisher'].get()).status).toBe(404);
      expect(
        (await theirs['template-publisher'].code.post({ email: 'm@example.com' })).status,
      ).toBe(404);
      expect((await theirs['template-publisher'].delete()).status).toBe(404);
      expect((await theirs['template-publisher'].author.put({ authorName: 'M' })).status).toBe(404);
      const one = theirs['project-templates']({ templateId: template.id });
      expect((await one.publication.post()).status).toBe(404);
      expect((await one.publication.delete()).status).toBe(404);
    });
  });

  describe('delete', () => {
    it('deletes the template and keeps the projects created from it', async () => {
      const { api, teamId, templates, template } = await setup();
      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });

      const deleted = await templates({ templateId: template.id }).delete();
      expect(deleted.status).toBe(204);
      expect((await templates.get()).data).toEqual([]);
      expect((await api.projects({ projectKey: 'NEW' }).get()).status).toBe(200);
    });

    it('404s for a template of another workspace, leaving it in place', async () => {
      const { templates } = await setup();
      const other = await setup();

      const deleted = await templates({ templateId: other.template.id }).delete();
      expect(deleted.status).toBe(404);
      expect((await other.templates.get()).data?.map((t) => t.id)).toEqual([other.template.id]);
    });
  });
});
