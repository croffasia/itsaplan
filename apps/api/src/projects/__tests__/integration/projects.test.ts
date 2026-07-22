import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Full integration flow: a real session against the real (test) database.
// Requires the test DB to be up and migrated:
//   cp .env.test.example .env.test
//   bun run db:migrate:test
// See apps/api/AGENTS.md "Tests" for the setup.
//
// The projects feature owns five routes: list, create, copy, the full work-items
// view, and delete. createProject seeds five default columns (one per state type)
// and a default "Member" role; it seeds no issue types or assignees.

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
      const { api } = await signUpClient();
      await setupSource(api);

      const copied = await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(copied.status).toBe(201);
      expect(copied.data).toMatchObject({ key: 'DST', name: 'Destination' });

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

    it('copies custom roles when selected, and not by default', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'SRC', name: 'Source' });
      await api.projects({ projectKey: 'SRC' }).roles.post({
        name: 'Editor',
        permissions: { work_items: { create: true, edit: true, read: true, delete: false } },
      });

      await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'NOR',
        name: 'No roles',
      });
      const withoutRoles = await api.projects({ projectKey: 'NOR' }).roles.get();
      expect(withoutRoles.data?.map((r) => r.name).sort()).toEqual(['Member']);

      await api.projects({ projectKey: 'SRC' }).copy.post({
        key: 'DST',
        name: 'Destination',
        include: { roles: true },
      });
      const withRoles = await api.projects({ projectKey: 'DST' }).roles.get();
      expect(withRoles.data?.map((r) => r.name).sort()).toEqual(['Editor', 'Member']);
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

  describe('mcp toggle', () => {
    // Marks a request as an MCP tool dispatch. The MCP endpoint sets this header on
    // its in-process loopback requests; the guards read it to gate the per-project
    // MCP toggle. A test forges it to exercise that path without going through /mcp.
    const asMcp = { headers: { 'x-mcp-loopback': '1' } };

    it('defaults a new project to MCP disabled', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const view = await viewOf(api, 'MKT');
      expect(view.data?.project.mcpEnabled).toBe(false);
    });

    it('lets an owner enable then disable MCP for the project', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const on = await api.projects({ projectKey: 'MKT' }).settings.patch({ mcpEnabled: true });
      expect(on.status).toBe(200);
      expect(on.data).toMatchObject({ mcpEnabled: true });
      expect((await viewOf(api, 'MKT')).data?.project.mcpEnabled).toBe(true);

      const off = await api.projects({ projectKey: 'MKT' }).settings.patch({ mcpEnabled: false });
      expect(off.status).toBe(200);
      expect(off.data).toMatchObject({ mcpEnabled: false });
      expect((await viewOf(api, 'MKT')).data?.project.mcpEnabled).toBe(false);
    });

    it('denies the toggle to a non-owner (owner-only)', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await outsider.api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ mcpEnabled: true });
      expect(res.status).toBe(403);
    });

    it('blocks an MCP call to a project with MCP disabled, but not a web call', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      // Web request (no MCP marker) reaches the disabled project fine.
      expect((await api.projects({ projectKey: 'MKT' }).get()).status).toBe(200);
      // The same request marked as MCP is denied while MCP is off.
      const blocked = await api.projects({ projectKey: 'MKT' }).get(asMcp);
      expect(blocked.status).toBe(403);
    });

    it('allows an MCP call once the project has MCP enabled', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await api.projects({ projectKey: 'MKT' }).settings.patch({ mcpEnabled: true });

      const res = await api.projects({ projectKey: 'MKT' }).get(asMcp);
      expect(res.status).toBe(200);
    });

    it('blocks an MCP call on an entity-by-id route of a disabled project', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const backlog = (await viewOf(api, 'MKT')).data!.columns.find((c) => c.name === 'Backlog')!;
      const issue = (
        await api
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId: backlog.id, title: 'Task' })
      ).data!;

      // Web read works; the MCP-marked read is denied while the project has MCP off.
      expect((await api.issues({ issueId: issue.id }).get()).status).toBe(200);
      expect((await api.issues({ issueId: issue.id }).get(asMcp)).status).toBe(403);
    });

    it('hides MCP-disabled projects from an MCP list_projects call', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'ON', name: 'Enabled' });
      await api.projects.post({ key: 'OFF', name: 'Disabled' });
      await api.projects({ projectKey: 'ON' }).settings.patch({ mcpEnabled: true });

      // A web list shows both; an MCP list shows only the enabled project.
      expect((await api.projects.get()).data?.map((p) => p.key).sort()).toEqual(['OFF', 'ON']);
      expect((await api.projects.get(asMcp)).data?.map((p) => p.key)).toEqual(['ON']);
    });
  });

  describe('settings', () => {
    it('defaults a new project to MCP off and the default auto-archive thresholds', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await api.projects({ projectKey: 'MKT' }).settings.get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        mcpEnabled: false,
        autoArchive: { completedDays: 28, canceledDays: 7 },
      });
    });

    it('lets an owner set and read back the auto-archive thresholds', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const patch = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ autoArchive: { completedDays: 28, canceledDays: 7 } });
      expect(patch.status).toBe(200);
      expect(patch.data?.autoArchive).toMatchObject({ completedDays: 28, canceledDays: 7 });

      const get = await api.projects({ projectKey: 'MKT' }).settings.get();
      expect(get.data?.autoArchive).toMatchObject({ completedDays: 28, canceledDays: 7 });
    });

    it('stores null to disable a state group', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ autoArchive: { completedDays: 30, canceledDays: null } });
      expect(res.status).toBe(200);
      expect(res.data?.autoArchive).toMatchObject({ completedDays: 30, canceledDays: null });
    });

    it('changes only the supplied field, leaving the other', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ autoArchive: { completedDays: 14, canceledDays: 3 } });

      const res = await api.projects({ projectKey: 'MKT' }).settings.patch({ mcpEnabled: true });
      expect(res.data).toMatchObject({
        mcpEnabled: true,
        autoArchive: { completedDays: 14, canceledDays: 3 },
      });
    });

    it('denies writing settings to a non-owner (owner-only)', async () => {
      const owner = await signUpClient();
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const outsider = await signUpClient();
      const res = await outsider.api
        .projects({ projectKey: 'MKT' })
        .settings.patch({ autoArchive: { completedDays: 28, canceledDays: 7 } });
      expect(res.status).toBe(403);
    });
  });
});
