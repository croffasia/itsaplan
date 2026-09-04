import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole, listProjectRoles } from '#tests/helpers/roles';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { clearLimits, setLimits } from '#tests/helpers/limits';

// Full integration flow: a real session against the real (test) database.
// Requires the test DB to be up and migrated:
//   cp .env.test.example .env.test
//   bun run db:migrate:test
// See apps/api/AGENTS.md "Tests" for the setup.
//
// The projects feature owns five routes: list, create, copy, the full work-items
// view, and delete. createProject seeds five default columns (one per state type);
// it seeds no issue types or assignees.

// createProject seeds one column per state type; a new project always has these
// five and nothing else.
const DEFAULT_COLUMN_NAMES = ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled'];

// Registers a user and returns a Treaty client acting as them.
async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

async function viewOf(client: Api, projectKey: string) {
  return client.projects({ projectKey }).get();
}

describe('projects', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(clearLimits);

  describe('create', () => {
    it('creates a project and lists it for its owner', async () => {
      const { api } = await signUpClient();

      const created = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ key: 'MKT', name: 'Marketing', description: '' });
      expect(typeof created.data?.id).toBe('number');

      const list = await api.projects.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(1);
      // The list reports the caller's role in each project; the creator is owner.
      expect(list.data?.[0]).toMatchObject({ key: 'MKT', name: 'Marketing', role: 'owner' });
    });

    it('puts the project in the team the account owns', async () => {
      const { user, api } = await signUpClient();
      const other = await signUpClient();

      const created = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      expect(created.data).toMatchObject({ teamName: user.username });

      const theirs = await other.api.projects.post({ key: 'OPS', name: 'Operations' });
      expect(theirs.data).toMatchObject({ teamName: other.user.username });

      const list = await api.projects.get();
      expect(list.data?.[0]).toMatchObject({
        key: 'MKT',
        teamId: created.data?.teamId,
        teamName: user.username,
      });
    });

    it('stores a provided description', async () => {
      const { api } = await signUpClient();
      const created = await api.projects.post({
        key: 'MKT',
        name: 'Marketing',
        description: 'Growth work',
      });
      expect(created.data).toMatchObject({ description: 'Growth work' });
    });

    it('seeds the five default columns', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const view = await viewOf(api, 'MKT');
      expect(view.status).toBe(200);
      expect(view.data?.columns.map((c) => c.name)).toEqual(DEFAULT_COLUMN_NAMES);
    });

    it('denies a project member whose rank in the team is member', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'SRC', name: 'Source' });
      const role = await createRole(owner.api, 'SRC', {
        name: 'Reader',
        permissions: { work_items: { read: true } },
      });
      const member = await addProjectMember(owner.api, 'SRC', role.data!.id);

      const res = await member.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(res.status).toBe(403);
    });

    it('rejects an empty key', async () => {
      const { api } = await signUpClient();
      const res = await api.projects.post({ key: '', name: 'Marketing' });
      expect(res.status).toBe(400);
    });

    it('rejects an empty name', async () => {
      const { api } = await signUpClient();
      const res = await api.projects.post({ key: 'MKT', name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing name', async () => {
      const { api } = await signUpClient();
      const res = await api.projects.post({ key: 'MKT' } as unknown as {
        key: string;
        name: string;
      });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate key with 409', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const dup = await api.projects.post({ key: 'MKT', name: 'Marketing Two' });
      expect(dup.status).toBe(409);
    });

    it('requires a session', async () => {
      // The anonymous client carries no cookie, so the session gate rejects it.
      const anon = authedApi('');
      const res = await anon.projects.post({ key: 'MKT', name: 'Marketing' });
      expect(res.status).toBe(401);
    });
  });

  describe('list', () => {
    it('returns only the projects the user is a member of, ordered by key', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'OPS', name: 'Operations' });
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const list = await api.projects.get();
      expect(list.status).toBe(200);
      expect(list.data?.map((p) => p.key)).toEqual(['MKT', 'OPS']);
    });

    it('does not show a project to a non-member', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const list = await outsider.api.projects.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(0);
    });

    it('omits permissions by default and includes them with the flag', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const bare = await api.projects.get();
      expect(bare.data?.[0].permissions).toBeUndefined();

      const withPerms = await api.projects.get({ query: { permissions: 'true' } });
      expect(withPerms.status).toBe(200);
      // The owner's matrix grants everything. The matrix is a loose Record over the
      // wire, so read it through a typed view.
      const perms = withPerms.data?.[0].permissions as
        Record<string, Record<string, boolean>> | undefined;
      expect(perms?.work_items.create).toBe(true);
    });
  });

  describe('update', () => {
    it("updates an owner's project name and description, leaving the key", async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await api
        .projects({ projectKey: 'MKT' })
        .patch({ name: 'Growth', description: 'Growth work' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ key: 'MKT', name: 'Growth', description: 'Growth work' });

      const view = await viewOf(api, 'MKT');
      expect(view.data?.project).toMatchObject({
        key: 'MKT',
        name: 'Growth',
        description: 'Growth work',
      });
    });

    it('rejects a description over the limit', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await api
        .projects({ projectKey: 'MKT' })
        .patch({ description: 'x'.repeat(2001) });
      expect(res.status).toBe(400);
    });

    it('denies a non-member (owner-only)', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await outsider.api.projects({ projectKey: 'MKT' }).patch({ name: 'Hijacked' });
      expect(res.status).toBe(403);
    });
  });

  describe('view', () => {
    it('returns the full work-items view for a member', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const view = await viewOf(api, 'MKT');
      expect(view.status).toBe(200);
      expect(view.data?.project).toMatchObject({ key: 'MKT', name: 'Marketing' });
      expect(view.data?.columns.map((c) => c.name)).toEqual(DEFAULT_COLUMN_NAMES);
      // The permission guard resolved the caller's own access; an owner's viewer
      // reports the owner role, and the sibling permission matrix grants everything.
      expect(view.data?.viewer.role).toBe('owner');
      expect(view.data?.permissions.work_items.create).toBe(true);
      expect(view.data?.permissions.danger_zone.delete).toBe(true);
    });

    it('includes every custom field of the project, both scopes', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const type = (await api.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' }))
        .data!;
      const cf = api.projects({ projectKey: 'MKT' })['custom-fields'];
      await cf.post({ name: 'Severity', fieldType: 'text' });
      await cf.post({ name: 'Steps', fieldType: 'text', issueTypeId: type.id });

      const view = await viewOf(api, 'MKT');
      expect(
        view.data?.customFields.map((f) => ({ name: f.name, issueTypeId: f.issueTypeId })),
      ).toEqual(
        expect.arrayContaining([
          { name: 'Severity', issueTypeId: null },
          { name: 'Steps', issueTypeId: type.id },
        ]),
      );
    });

    it('returns 404 for an unknown project', async () => {
      const { api } = await signUpClient();
      const res = await viewOf(api, 'NOPE');
      expect(res.status).toBe(404);
    });

    it('denies a non-member with 403', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await viewOf(outsider.api, 'MKT');
      expect(res.status).toBe(403);
    });

    it('opens to a member whose role grants nothing, so any role can enter the project', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const role = await createRole(owner.api, 'MKT', {
        name: 'Notes only',
        permissions: { note_boards: { read: true } },
      });
      const member = await addProjectMember(owner.api, 'MKT', role.data!.id);

      const res = await viewOf(member, 'MKT');
      expect(res.status).toBe(200);
      expect(res.data!.permissions.work_items.read).toBe(false);
      // The issues themselves stay behind the work items resource.
      expect((await member.projects({ projectKey: 'MKT' }).issues.board.get()).status).toBe(403);
    });
  });

  describe('copy', () => {
    // Builds a source project with one label and one issue, so a copy can assert
    // the structure is copied but the issues are not.
    async function setupSource(api: Api) {
      await api.projects.post({ key: 'SRC', name: 'Source' });
      const backlog = (await viewOf(api, 'SRC')).data!.columns.find((c) => c.name === 'Backlog')!;
      await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });
      await api
        .projects({ projectKey: 'SRC' })
        .issues.post({ columnId: backlog.id, title: 'Task' });
    }

    it('copies the structure into a new project owned by the caller', async () => {
      const { user, api } = await signUpClient();
      await setupSource(api);

      const copied = await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(copied.status).toBe(201);
      expect(copied.data).toMatchObject({
        key: 'DST',
        name: 'Destination',
        teamName: user.username,
      });

      // The copy is owned by the caller: it shows up in their project list.
      const list = await api.projects.get();
      expect(list.data?.map((p) => p.key)).toContain('DST');

      const view = await viewOf(api, 'DST');
      expect(view.data?.columns.map((c) => c.name)).toEqual(DEFAULT_COLUMN_NAMES);
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
      expect(view.data?.viewer.role).toBe('owner');
    });

    it("does not copy the source project's issues", async () => {
      const { api } = await signUpClient();
      await setupSource(api);
      const src = await api.projects({ projectKey: 'SRC' }).issues.board.get();
      expect(src.data?.issues).toHaveLength(1);

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const dst = await api.projects({ projectKey: 'DST' }).issues.board.get();
      expect(dst.data?.issues).toHaveLength(0);
    });

    it("copies the source project's issue types", async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await api.projects({ projectKey: 'SRC' })['issue-types'].post({ name: 'Bug' });

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const view = await viewOf(api, 'DST');
      // The source starts with the seeded default "Task" type; both it and the
      // added "Bug" carry over to the copy.
      expect(view.data?.issueTypes.map((t) => t.name)).toEqual(['Task', 'Bug']);
    });

    it('copies which optional sections the source project shows', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await api
        .projects({ projectKey: 'SRC' })
        .settings.patch({ features: { notes: false, dashboards: false } });

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const settings = await api.projects({ projectKey: 'DST' }).settings.get();
      expect(settings.data?.features).toEqual({
        initiatives: true,
        cycles: true,
        dashboards: false,
        notes: false,
        subtasks: true,
        checklists: true,
        issueStats: true,
      });
    });

    it('takes mcpEnabled from the instance default, not from the source project', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const source = (await api.projects.post({ key: 'SRC', name: 'Source' })).data!;
      await api
        .teams({ teamId })
        .mcp.patch({ projects: [{ projectId: source.id, enabled: false }] });

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const settings = await api.projects({ projectKey: 'DST' }).settings.get();
      expect(settings.data?.mcpEnabled).toBe(true);
    });

    // The other direction, so the copy is shown to read the default rather than to
    // carry a fixed value. The first account of a fresh database holds the god role.
    it('copies a project with MCP off once the instance default is turned off', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await api.god['project-defaults'].put({ mcpEnabled: false });

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const settings = await api.projects({ projectKey: 'DST' }).settings.get();
      expect(settings.data?.mcpEnabled).toBe(false);
    });

    it('copies the estimate kinds and time logging the source project carries', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await api.projects({ projectKey: 'SRC' }).settings.estimates.patch({
        points: true,
        time: true,
        logging: true,
      });

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const view = await viewOf(api, 'DST');
      expect(view.data?.project).toMatchObject({
        pointsEstimateEnabled: true,
        timeEstimateEnabled: true,
        timeLoggingEnabled: true,
      });
    });

    it("remaps a saved view's filter ids to the copied project's entities", async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      const srcBacklog = (await viewOf(api, 'SRC')).data!.columns.find(
        (c) => c.name === 'Backlog',
      )!;
      // A view whose status filter references the source project's Backlog column.
      await api.projects({ projectKey: 'SRC' }).views.post({
        name: 'Open',
        filters: { conditions: [{ field: 'status', op: 'in', values: [srcBacklog.id] }] },
      });

      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const dstBacklog = (await viewOf(api, 'DST')).data!.columns.find(
        (c) => c.name === 'Backlog',
      )!;
      // The columns are distinct rows, so the copied view's filter must point at
      // the new column id, not the source's.
      expect(dstBacklog.id).not.toBe(srcBacklog.id);
      const dstViews = await api.projects({ projectKey: 'DST' }).views.get();
      const filters = dstViews.data![0].filters as {
        conditions: { field: string; values: number[] }[];
      };
      expect(filters.conditions[0].values).toEqual([dstBacklog.id]);
    });

    it('gives a copied webhook its own secret and leaves it off', async () => {
      const { api } = await signUpClient();
      await setupSource(api);
      const source = await api.projects({ projectKey: 'SRC' }).webhooks.post({
        url: 'https://example.com/hook',
        events: ['issue.created'],
      });

      await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
        include: { webhooks: true },
      });

      expect(source.data!.isActive).toBe(true);
      const copied = (await api.projects({ projectKey: 'DST' }).webhooks.get()).data![0];
      expect(copied.url).toBe('https://example.com/hook');
      expect(copied.secret).not.toBe(source.data!.secret);
      expect(copied.isActive).toBe(false);
    });

    it('copies only the sections named in include, seeding default states', async () => {
      const { api } = await signUpClient();
      await setupSource(api);
      await api.projects({ projectKey: 'SRC' })['issue-types'].post({ name: 'Bug' });

      // Copy the labels only. States are not selected, so the copy gets the default
      // columns; issue types are not selected, so it has none.
      const copied = await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
        include: { labels: true },
      });
      expect(copied.status).toBe(201);

      const view = await viewOf(api, 'DST');
      expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
      expect(view.data?.columns.map((c) => c.name)).toEqual(DEFAULT_COLUMN_NAMES);
      expect(view.data?.issueTypes).toHaveLength(0);
    });

    it('force-enables a dependency: copying views pulls in the referenced states', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      const review = (
        await api
          .projects({ projectKey: 'SRC' })
          .columns.post({ name: 'Review', stateType: 'started', color: '#123456' })
      ).data!;
      await api.projects({ projectKey: 'SRC' }).views.post({
        name: 'In review',
        filters: { conditions: [{ field: 'status', op: 'in', values: [review.id] }] },
      });

      // include names views only; the API must also copy the states the view's
      // filter references, and remap the filter to the copied column.
      await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
        include: { views: true },
      });

      const dstReview = (await viewOf(api, 'DST')).data!.columns.find((c) => c.name === 'Review')!;
      expect(dstReview).toBeDefined();
      expect(dstReview.id).not.toBe(review.id);
      const dstViews = await api.projects({ projectKey: 'DST' }).views.get();
      const filters = dstViews.data![0].filters as {
        conditions: { field: string; values: number[] }[];
      };
      expect(filters.conditions[0].values).toEqual([dstReview.id]);
    });

    it("draws on the target team's roles, which the source team's do not reach", async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await createRole(api, 'SRC', {
        name: 'Editor',
        permissions: { work_items: { create: true, edit: true, read: true, delete: false } },
      });

      // The copy lands in the caller's own team, which shares its roles with every
      // project it owns, so the source project's roles come along with it.
      await api.projects({ projectKey: 'SRC' }).copy.post({ key: 'DST', name: 'Destination' });

      const roles = await listProjectRoles(api, 'DST');
      expect(roles.data?.map((r) => r.name).sort()).toEqual(['Editor', 'Member']);
    });

    // The team owns its agents, so a copy inside it puts the same agent in the new
    // project — no second agent, no second bot user, no new key.
    it("puts the source project's agents in a copy inside the team", async () => {
      const { api, user } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await createAgent(api, 'SRC', {
        name: 'Ext',
        username: 'ext',
        kind: 'external',
        runnerScope: 'owner',
      });

      await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
        include: { agents: true },
      });

      const teamId = await teamOf(api, 'DST');
      const copied = await api
        .teams({ teamId })
        ['ai-agents'].get({ query: { projectId: await projectIdOf(api, 'DST') } });
      expect(copied.data?.[0]).toMatchObject({ runnerScope: 'owner', ownerUserId: user.userId });
      expect((await api.teams({ teamId })['ai-agents'].get()).data).toHaveLength(1);
    });

    it('carries no agent into another team', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await createAgent(api, 'SRC', { name: 'Ext', username: 'ext', kind: 'external' });
      const target = (await api.teams.post({ name: 'Other Team' })).data!;
      const sourceId = await projectIdOf(api, 'SRC');

      await api
        .teams({ teamId: target.id })
        .projects({ projectId: sourceId })
        .copy.post({
          key: 'DST',
          name: 'Destination',
          include: { agents: true, schedules: true },
        });

      expect((await api.teams({ teamId: target.id })['ai-agents'].get()).data).toEqual([]);
    });

    it('returns 400 with an error body on a duplicate key', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await api.projects.post({ key: 'DST', name: 'Existing' });

      const res = await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown source project', async () => {
      const { api } = await signUpClient();
      const res = await api.projects({ projectKey: 'NOPE' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(res.status).toBe(404);
    });

    it('denies a non-member with 403', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'SRC', name: 'Source' });

      const outsider = await signUpClient();
      const res = await outsider.api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(res.status).toBe(403);
    });

    it('rejects an empty key', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      const res = await api
        .projects({ projectKey: 'SRC' })
        .copy.post({ key: '', name: 'Destination' });
      expect(res.status).toBe(400);
    });
  });

  describe('delete', () => {
    it('deletes a project and its scoped entities for an owner', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const backlog = (await viewOf(api, 'MKT')).data!.columns.find((c) => c.name === 'Backlog')!;
      await api
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: backlog.id, title: 'Task' });

      const del = await api.projects({ projectKey: 'MKT' }).delete();
      expect(del.status).toBe(204);

      // The project and everything under it are gone: the view 404s and the list
      // is empty.
      expect((await viewOf(api, 'MKT')).status).toBe(404);
      expect((await api.projects.get()).data).toHaveLength(0);
    });

    it('returns 404 for an unknown project', async () => {
      const { api } = await signUpClient();
      const res = await api.projects({ projectKey: 'NOPE' }).delete();
      expect(res.status).toBe(404);
    });

    it('denies a non-member with 403', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await outsider.api.projects({ projectKey: 'MKT' }).delete();
      expect(res.status).toBe(403);
    });
  });

  describe('mcp reach', () => {
    // Marks a request as an MCP tool dispatch. The MCP endpoint sets this header on
    // its in-process loopback requests; the guards read it to gate MCP access. A test
    // forges it to exercise that path without going through /mcp.
    const asMcp = { headers: { 'x-mcp-loopback': '1' } };

    // The team a project belongs to, whose MCP settings decide its reach.
    async function teamOf(client: Api, projectKey: string): Promise<number> {
      const view = await client.projects({ projectKey }).get();
      return view.data!.project.teamId;
    }

    it('defaults a new project to the instance project default (MCP on)', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const view = await viewOf(api, 'MKT');
      expect(view.data?.project).toMatchObject({ mcpEnabled: true, teamMcpEnabled: true });
    });

    it('no longer takes the toggle on the project settings route', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      // The field is gone from the body schema, so an old client sending it changes
      // nothing rather than reopening the project from outside the team's settings.
      const res = await api.projects({ projectKey: 'MKT' }).settings.patch({
        mcpEnabled: false,
      } as never);
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ mcpEnabled: true });
      expect((await viewOf(api, 'MKT')).data?.project.mcpEnabled).toBe(true);
    });

    it('blocks an MCP call to a project the team no longer covers, but not a web call', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = await teamOf(api, 'MKT');
      const projectId = (await viewOf(api, 'MKT')).data!.project.id;
      await api.teams({ teamId }).mcp.patch({ projects: [{ projectId, enabled: false }] });

      // Web request (no MCP marker) reaches the project fine.
      expect((await api.projects({ projectKey: 'MKT' }).get()).status).toBe(200);
      const blocked = await api.projects({ projectKey: 'MKT' }).get(asMcp);
      expect(blocked.status).toBe(403);
      expect((blocked.error?.value as { error: string }).error).toBe(
        'MCP is disabled for this project',
      );
    });

    it("blocks an MCP call to every project once the team's switch is off", async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = await teamOf(api, 'MKT');
      await api.teams({ teamId }).mcp.patch({ enabled: false });

      expect((await api.projects({ projectKey: 'MKT' }).get()).status).toBe(200);
      const blocked = await api.projects({ projectKey: 'MKT' }).get(asMcp);
      expect(blocked.status).toBe(403);
      expect((blocked.error?.value as { error: string }).error).toBe(
        'MCP is disabled for this team',
      );
    });

    it('blocks an MCP call on an entity-by-id route of a project out of reach', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = await teamOf(api, 'MKT');
      const projectId = (await viewOf(api, 'MKT')).data!.project.id;
      await api.teams({ teamId }).mcp.patch({ projects: [{ projectId, enabled: false }] });
      const backlog = (await viewOf(api, 'MKT')).data!.columns.find((c) => c.name === 'Backlog')!;
      const issue = (
        await api
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId: backlog.id, title: 'Task' })
      ).data!;

      expect((await api.issues({ issueId: issue.id }).get()).status).toBe(200);
      expect((await api.issues({ issueId: issue.id }).get(asMcp)).status).toBe(403);
    });

    it('hides projects out of reach from an MCP list_projects call', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'ON', name: 'Enabled' });
      await api.projects.post({ key: 'OFF', name: 'Disabled' });
      const teamId = await teamOf(api, 'OFF');
      const projectId = (await viewOf(api, 'OFF')).data!.project.id;
      await api.teams({ teamId }).mcp.patch({ projects: [{ projectId, enabled: false }] });

      expect((await api.projects.get()).data?.map((p) => p.key).sort()).toEqual(['OFF', 'ON']);
      expect((await api.projects.get(asMcp)).data?.map((p) => p.key)).toEqual(['ON']);
    });
  });

  describe('settings', () => {
    it('defaults a new project to the instance project default (MCP on)', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await api.projects({ projectKey: 'MKT' }).settings.get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ mcpEnabled: true, teamMcpEnabled: true });
    });

    it('starts a new project with every optional section enabled', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await api.projects({ projectKey: 'MKT' }).settings.get();
      expect(res.data?.features).toMatchObject({
        initiatives: true,
        dashboards: true,
        notes: true,
        subtasks: true,
        checklists: true,
        issueStats: true,
      });
      expect((await viewOf(api, 'MKT')).data?.project).toMatchObject({
        initiativesEnabled: true,
        dashboardsEnabled: true,
        notesEnabled: true,
        subtasksEnabled: true,
        checklistsEnabled: true,
        issueStatsEnabled: true,
      });
    });

    it('lets an owner turn a section off and back on, leaving the others', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const off = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { initiatives: false } });
      expect(off.status).toBe(200);
      expect(off.data?.features).toMatchObject({
        initiatives: false,
        dashboards: true,
        notes: true,
      });
      expect((await viewOf(api, 'MKT')).data?.project.initiativesEnabled).toBe(false);

      const on = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { initiatives: true } });
      expect(on.data?.features).toMatchObject({ initiatives: true });
      expect((await viewOf(api, 'MKT')).data?.project.initiativesEnabled).toBe(true);
    });

    it('lets an owner turn off the sections of an issue', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const off = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { subtasks: false, checklists: false, issueStats: false } });
      expect(off.status).toBe(200);
      expect(off.data?.features).toMatchObject({
        subtasks: false,
        checklists: false,
        issueStats: false,
      });
      expect((await viewOf(api, 'MKT')).data?.project).toMatchObject({
        subtasksEnabled: false,
        checklistsEnabled: false,
        issueStatsEnabled: false,
      });
    });

    it('closes the routes and the fields of a section that is turned off', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const columnId = (await viewOf(api, 'MKT')).data!.columns[0].id;
      const parent = await api.projects({ projectKey: 'MKT' }).issues.post({
        columnId,
        title: 'Parent',
      });
      await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { initiatives: false, checklists: false, subtasks: false } });

      expect((await api.projects({ projectKey: 'MKT' }).initiatives.get()).status).toBe(403);
      expect(
        (await api.issues({ issueId: parent.data!.id }).checklists.post({ title: 'Steps' })).status,
      ).toBe(403);
      // A field reaching a closed section is refused with it, not only its own routes.
      const subtask = await api
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId, title: 'Subtask', parentId: parent.data!.id });
      expect(subtask.status).toBe(403);
    });

    it('reports a section the team cannot use as off and refuses to turn it on', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      setLimits({ blockedFeatures: ['initiatives'] });

      const settings = await api.projects({ projectKey: 'MKT' }).settings.get();
      expect(settings.data?.features).toMatchObject({ initiatives: false, dashboards: true });

      const project = (await viewOf(api, 'MKT')).data!.project;
      expect(project.initiativesEnabled).toBe(false);
      expect(project.availableFeatures).not.toContain('initiatives');
      expect(project.availableFeatures).toContain('dashboards');

      const on = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { initiatives: true } });
      expect(on.status).toBe(400);
      expect((await api.projects({ projectKey: 'MKT' }).initiatives.get()).status).toBe(403);

      // The block is not stored on the project: it applies again as soon as it is gone.
      clearLimits();
      expect((await viewOf(api, 'MKT')).data!.project.initiativesEnabled).toBe(true);
    });

    it('denies turning a section off to a non-owner (owner-only)', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await outsider.api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { notes: false } });
      expect(res.status).toBe(403);
    });

    it('changes only the supplied field, leaving the other', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await api.projects({ projectKey: 'MKT' }).settings.patch({ features: { notes: false } });

      const res = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { checklists: false } });
      expect(res.data?.features).toMatchObject({ notes: false, checklists: false });
    });

    it('denies writing settings to someone outside the project and its team', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await outsider.api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { notes: false } });
      expect(res.status).toBe(403);
    });

    it('denies writing settings to a plain member of the project', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addProjectMember(owner.api, 'MKT');

      const res = await member
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { notes: false } });
      expect(res.status).toBe(403);
    });

    it("lets the team's owner write settings on a project they left", async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      // Hand MKT to someone else and leave it. The team still owns the project, so
      // its owner keeps the settings without a membership of their own.
      const successor = await signUpClient();
      const invite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: successor.user.email, role: 'owner' });
      await successor.api.invites({ token: invite.data!.token }).accept.post();
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: owner.user.userId })
        .delete();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ features: { notes: false } });
      expect(res.status).toBe(200);
      expect(res.data?.features).toMatchObject({ notes: false });
    });
  });

  describe('auto-archive settings', () => {
    const autoArchive = (client: Api) =>
      client.projects({ projectKey: 'MKT' }).settings['auto-archive'];

    it('defaults a new project to the default thresholds', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await autoArchive(api).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ completedDays: 28, canceledDays: 7 });
    });

    it('lets an owner set and read back the thresholds', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const patch = await autoArchive(api).patch({ completedDays: 14, canceledDays: 3 });
      expect(patch.status).toBe(200);
      expect(patch.data).toMatchObject({ completedDays: 14, canceledDays: 3 });

      expect((await autoArchive(api).get()).data).toMatchObject({
        completedDays: 14,
        canceledDays: 3,
      });
    });

    it('stores null to disable a state group', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await autoArchive(api).patch({ completedDays: 30, canceledDays: null });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ completedDays: 30, canceledDays: null });
    });

    it('rejects a day count below 1', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await autoArchive(api).patch({ completedDays: 0, canceledDays: 7 });
      expect(res.status).toBe(400);
    });

    // The worker subtracts this from now() for every project in one statement, so a
    // day count no interval can carry fails that statement for the whole instance.
    it('rejects a day count no interval can carry', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await autoArchive(api).patch({ completedDays: 3_000_000, canceledDays: 7 });
      expect(res.status).toBe(400);
    });

    it('holds the default member role out of the section', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addProjectMember(owner.api, 'MKT');

      expect((await autoArchive(member).get()).status).toBe(403);
      expect((await autoArchive(member).patch({ completedDays: 14, canceledDays: 3 })).status).toBe(
        403,
      );
    });

    it('lets a granted role read the thresholds but not change them without edit', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const role = await createRole(owner.api, 'MKT', {
        name: 'Reader',
        permissions: { workflow_config: { read: true } },
      });
      const member = await addProjectMember(owner.api, 'MKT', role.data!.id);

      expect((await autoArchive(member).get()).status).toBe(200);
      expect((await autoArchive(member).patch({ completedDays: 14, canceledDays: 3 })).status).toBe(
        403,
      );
    });

    it('lets a role with edit change the thresholds', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const role = await createRole(owner.api, 'MKT', {
        name: 'Archivist',
        permissions: { workflow_config: { read: true, edit: true } },
      });
      const member = await addProjectMember(owner.api, 'MKT', role.data!.id);

      const res = await autoArchive(member).patch({ completedDays: 14, canceledDays: 3 });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ completedDays: 14, canceledDays: 3 });
    });
  });

  describe('estimate settings', () => {
    const estimates = (client: Api) => client.projects({ projectKey: 'MKT' }).settings.estimates;

    it('defaults a new project to both kinds and time logging off', async () => {
      const { api } = await signUpClient();
      const created = await api.projects.post({ key: 'MKT', name: 'Marketing' });

      expect(created.data).toMatchObject({
        pointsEstimateEnabled: false,
        timeEstimateEnabled: false,
        timeLoggingEnabled: false,
      });
    });

    it('lets an owner turn a kind on and reads it back with the project', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const patch = await estimates(api).patch({ points: true, time: false, logging: true });
      expect(patch.status).toBe(200);
      expect(patch.data).toMatchObject({ points: true, time: false, logging: true });

      const view = await viewOf(api, 'MKT');
      expect(view.data?.project).toMatchObject({
        pointsEstimateEnabled: true,
        timeEstimateEnabled: false,
        timeLoggingEnabled: true,
      });
    });

    it('keeps the estimates on the issues when a kind is turned off', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const view = await viewOf(api, 'MKT');
      await estimates(api).patch({ points: true, time: true, logging: false });
      const issue = await api
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: view.data!.columns[0].id, title: 'Sized', estimatePoints: 5 });

      await estimates(api).patch({ points: false, time: false, logging: false });
      expect((await api.issues({ issueId: issue.data!.id }).get()).data).toMatchObject({
        estimatePoints: 5,
      });
    });

    it('holds the default member role out of the section', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addProjectMember(owner.api, 'MKT');

      expect(
        (await estimates(member).patch({ points: true, time: true, logging: true })).status,
      ).toBe(403);
    });

    it('lets a role with edit change the kinds', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const role = await createRole(owner.api, 'MKT', {
        name: 'Planner',
        permissions: { workflow_config: { read: true, edit: true } },
      });
      const member = await addProjectMember(owner.api, 'MKT', role.data!.id);

      const res = await estimates(member).patch({ points: true, time: true, logging: true });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ points: true, time: true, logging: true });
    });
  });

  describe('subtask automation settings', () => {
    const subtasks = (client: Api) => client.projects({ projectKey: 'MKT' }).settings.subtasks;

    it('defaults a new project to both automations off', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await subtasks(api).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ completeParent: false, closeSubtasks: false });
    });

    it('lets an owner set and read back the automations', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const patch = await subtasks(api).patch({ completeParent: true, closeSubtasks: false });
      expect(patch.status).toBe(200);
      expect(patch.data).toMatchObject({ completeParent: true, closeSubtasks: false });

      expect((await subtasks(api).get()).data).toMatchObject({
        completeParent: true,
        closeSubtasks: false,
      });
    });

    it('holds the default member role out of the section', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addProjectMember(owner.api, 'MKT');

      expect((await subtasks(member).get()).status).toBe(403);
      expect(
        (await subtasks(member).patch({ completeParent: true, closeSubtasks: true })).status,
      ).toBe(403);
    });

    it('lets a granted role read the automations but not change them without edit', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const role = await createRole(owner.api, 'MKT', {
        name: 'Reader',
        permissions: { workflow_config: { read: true } },
      });
      const member = await addProjectMember(owner.api, 'MKT', role.data!.id);

      expect((await subtasks(member).get()).status).toBe(200);
      expect(
        (await subtasks(member).patch({ completeParent: true, closeSubtasks: true })).status,
      ).toBe(403);
    });
  });
});
