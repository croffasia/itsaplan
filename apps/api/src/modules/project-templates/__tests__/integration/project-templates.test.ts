import { beforeEach, describe, expect, it } from 'bun:test';
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
  return api;
}

// A team with the project SRC, which has the label "bug", saved as the template "Kanban".
async function setup() {
  const { api } = await signUpClient();
  const teamId = await ownTeamId(api);
  const source = (await createProject(api, { key: 'SRC', name: 'Source' })).data!;
  await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });
  const saved = await api
    .teams({ teamId })
    ['project-templates'].post({ projectId: source.id, name: 'Kanban', description: 'Our board' });
  expect(saved.status).toBe(201);
  return { api, teamId, source, template: saved.data! };
}

describe('project templates', () => {
  beforeEach(resetDb);

  describe('save', () => {
    it('lists the template and leaves it out of every project list', async () => {
      const { api, teamId, template } = await setup();
      expect(template).toMatchObject({ name: 'Kanban', description: 'Our board' });

      const list = await api.teams({ teamId })['project-templates'].get();
      expect(list.status).toBe(200);
      expect(list.data).toMatchObject([{ id: template.id, name: 'Kanban' }]);

      // The first account owns its workspace, so it reaches every project of it.
      expect((await api.projects.get()).data?.map((p) => p.key)).toEqual(['SRC']);
      expect((await api.projects.search.get({ query: {} })).data?.total).toBe(1);
      const teamProjects = await api.teams({ teamId }).projects.get();
      expect(teamProjects.data?.items.map((p) => p.key)).toEqual(['SRC']);
      expect((await api.teams.get()).data![0]).toMatchObject({ projectCount: 1, templateCount: 1 });
      const asProject = await api.teams({ teamId }).projects({ projectId: template.id }).get();
      expect(asProject.status).toBe(404);
    });

    it('keeps what was saved when the project changes later', async () => {
      const { api, teamId, template } = await setup();
      await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'later', color: '#00ff00' });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });

      const view = await api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
    });

    it('leaves out the docs and the webhooks', async () => {
      const { api, teamId, source } = await setup();
      const sourceApi = api.projects({ projectKey: 'SRC' });
      await sourceApi.documents.post({ title: 'Runbook' });
      await sourceApi.webhooks.post({ url: 'https://example.com/hook', events: ['issue.created'] });
      const saved = await api.teams({ teamId })['project-templates'].post({
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
      const { api, teamId, source } = await setup();
      const saved = await api.teams({ teamId })['project-templates'].post({
        projectId: source.id,
        name: 'States only',
        include: { states: true },
      });

      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

      const view = await api.projects({ projectKey: 'NEW' }).get();
      expect(view.data?.labels).toEqual([]);
    });

    it('rejects an empty name', async () => {
      const { api, teamId, source } = await setup();
      const saved = await api
        .teams({ teamId })
        ['project-templates'].post({ projectId: source.id, name: '' });
      expect(saved.status).toBe(400);
    });

    it('404s for a project of another team and for a template', async () => {
      const { api, teamId, template } = await setup();
      const other = await signUpClient();
      const otherProject = (await createProject(other.api, { key: 'OTH', name: 'Other' })).data!;

      const fromOther = await api
        .teams({ teamId })
        ['project-templates'].post({ projectId: otherProject.id, name: 'Theirs' });
      expect(fromOther.status).toBe(404);
      const fromTemplate = await api
        .teams({ teamId })
        ['project-templates'].post({ projectId: template.id, name: 'Again' });
      expect(fromTemplate.status).toBe(404);
    });

    it('is left to the owners and managers of the team', async () => {
      const { api, teamId, source, template } = await setup();
      const member = await addTeamMember(api, teamId, 'member');
      const manager = await addTeamMember(api, teamId, 'manager');

      const templates = member.teams({ teamId })['project-templates'];
      expect((await templates.get()).status).toBe(403);
      expect((await templates({ templateId: template.id }).get()).status).toBe(403);
      expect((await templates.post({ projectId: source.id, name: 'Mine' })).status).toBe(403);
      expect((await templates({ templateId: template.id }).delete()).status).toBe(403);

      const saved = await manager
        .teams({ teamId })
        ['project-templates'].post({ projectId: source.id, name: 'Manager' });
      expect(saved.status).toBe(201);
    });
  });

  describe('detail', () => {
    it('shows what the template holds', async () => {
      const { api, teamId, template } = await setup();

      const detail = await api
        .teams({ teamId })
        ['project-templates']({ templateId: template.id })
        .get();
      expect(detail.status).toBe(200);
      expect(detail.data).toMatchObject({
        id: template.id,
        name: 'Kanban',
        description: 'Our board',
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
    });

    it('404s for a project and for a template of another team', async () => {
      const { api, teamId, source } = await setup();
      const other = await setup();
      const templates = api.teams({ teamId })['project-templates'];

      expect((await templates({ templateId: source.id }).get()).status).toBe(404);
      expect((await templates({ templateId: other.template.id }).get()).status).toBe(404);
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

    it("404s for another team's template and for a project", async () => {
      const { api, teamId, source } = await setup();
      const other = await setup();

      const fromOther = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: other.template.id });
      expect(fromOther.status).toBe(404);
      const fromProject = await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: source.id });
      expect(fromProject.status).toBe(404);
    });
  });

  describe('delete', () => {
    it('deletes the template and keeps the projects created from it', async () => {
      const { api, teamId, template } = await setup();
      await api
        .teams({ teamId })
        .projects.post({ key: 'NEW', name: 'New', templateId: template.id });

      const deleted = await api
        .teams({ teamId })
        ['project-templates']({ templateId: template.id })
        .delete();
      expect(deleted.status).toBe(204);
      expect((await api.teams({ teamId })['project-templates'].get()).data).toEqual([]);
      expect((await api.projects({ projectKey: 'NEW' }).get()).status).toBe(200);
    });

    it('404s for a project, leaving it in place', async () => {
      const { api, teamId, source } = await setup();

      const deleted = await api
        .teams({ teamId })
        ['project-templates']({ templateId: source.id })
        .delete();
      expect(deleted.status).toBe(404);
      expect((await api.projects({ projectKey: 'SRC' }).get()).status).toBe(200);
    });

    it('goes with its team', async () => {
      await signUpTestUser();
      const { api } = await signUpClient();
      const teamId = await ownTeamId(api);
      const project = (await createProject(api, { key: 'OPS', name: 'Operations' })).data!;
      await api.teams({ teamId })['project-templates'].post({ projectId: project.id, name: 'Ops' });
      await api.teams({ teamId }).projects({ projectId: project.id }).delete();

      expect((await api.teams({ teamId }).delete()).status).toBe(204);
    });
  });
});
