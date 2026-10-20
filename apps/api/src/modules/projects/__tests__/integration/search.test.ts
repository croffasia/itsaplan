import { beforeEach, describe, expect, it } from 'bun:test';
import { db, team } from '@repo/db';
import { eq } from 'drizzle-orm';
import { app, authedApi, type Api, ownWorkspaceId, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function setup() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

type SearchQuery = NonNullable<
  NonNullable<Parameters<Api['projects']['search']['get']>[0]>['query']
>;

function search(api: Api, query: SearchQuery) {
  return api.projects.search.get({ query });
}

const keys = (result: Awaited<ReturnType<typeof search>>) => result.data?.items.map((p) => p.key);

describe('project search', () => {
  beforeEach(resetDb);

  it('pages the projects and counts every match', async () => {
    const { api } = await setup();
    for (const key of ['A', 'B', 'C']) await createProject(api, { key, name: key });

    const first = await search(api, { pageSize: 2 });
    expect(first.status).toBe(200);
    expect(first.data).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(keys(first)).toEqual(['A', 'B']);
    expect(keys(await search(api, { pageSize: 2, page: 2 }))).toEqual(['C']);
    const past = await search(api, { pageSize: 2, page: 3 });
    expect(past.data).toMatchObject({ items: [], total: 3 });
  });

  it('filters by workspace, team, id and text', async () => {
    const { api } = await setup();
    const one = (await createProject(api, { key: 'ONE', name: 'Shared name' })).data!;
    const workspaceId = await ownWorkspaceId(api);
    const second = (await api.teams.post({ name: 'Second team', slug: 'second-team', workspaceId }))
      .data!;
    const two = (
      await api.teams({ teamId: second.id }).projects.post({ key: 'TWO', name: 'Other' })
    ).data!;
    const other = await setup();
    const otherWorkspaceId = await ownWorkspaceId(other.api);

    expect(keys(await search(api, { workspaceId }))).toEqual(['ONE', 'TWO']);
    expect(keys(await search(api, { workspaceId: otherWorkspaceId }))).toEqual([]);
    expect(keys(await search(api, { teamId: second.id }))).toEqual(['TWO']);
    expect(keys(await search(api, { ids: `${two.id},${one.id}` }))).toEqual(['ONE', 'TWO']);
    expect(keys(await search(api, { ids: String(two.id), q: 'shared' }))).toEqual([]);
    expect(keys(await search(api, { q: 'shared' }))).toEqual(['ONE']);
  });

  it("filters by the caller's star and hidden marks", async () => {
    const { api } = await setup();
    for (const key of ['FAV', 'HID', 'PLAIN']) await createProject(api, { key, name: key });
    await api.projects({ projectKey: 'FAV' }).preferences.patch({ isFavorite: true });
    await api.projects({ projectKey: 'HID' }).preferences.patch({ isHidden: true });

    expect(keys(await search(api, { favorite: 'true' }))).toEqual(['FAV']);
    expect(keys(await search(api, { favorite: 'false' }))).toEqual(['HID', 'PLAIN']);
    expect(keys(await search(api, { hidden: 'true' }))).toEqual(['HID']);
    expect(keys(await search(api, { hidden: 'false' }))).toEqual(['FAV', 'PLAIN']);
  });

  it('puts starred projects first, each part in the order asked for', async () => {
    const { api } = await setup();
    for (const key of ['A', 'B', 'C', 'D']) await createProject(api, { key, name: key });
    for (const key of ['D', 'B']) {
      await api.projects({ projectKey: key }).preferences.patch({ isFavorite: true });
    }

    expect(keys(await search(api, {}))).toEqual(['B', 'D', 'A', 'C']);
    expect(keys(await search(api, { sort: 'created' }))).toEqual(['D', 'B', 'C', 'A']);
  });

  it('counts a project reached through the workspace as neither starred nor hidden', async () => {
    const owner = await signUpTestUser({ team: false });
    const lead = await setup();
    const project = (await createProject(lead.api, { key: 'MKT', name: 'Marketing' })).data!;
    await db
      .update(team)
      .set({ workspaceId: owner.workspaceId! })
      .where(eq(team.id, project.teamId));
    const asOwner = authedApi(owner.cookie);

    const visible = await search(asOwner, { hidden: 'false' });
    expect(visible.data?.items).toEqual([
      expect.objectContaining({ key: 'MKT', via: 'workspace', isHidden: false }),
    ]);
    expect(keys(await search(asOwner, { hidden: 'true' }))).toEqual([]);
    expect(keys(await search(asOwner, { favorite: 'true' }))).toEqual([]);
  });

  it("returns none of another person's projects, even by id", async () => {
    const { api } = await setup();
    const project = (await createProject(api, { key: 'MKT', name: 'Marketing' })).data!;
    const other = await setup();

    const result = await search(other.api, { ids: String(project.id) });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ items: [], total: 0 });
  });

  it('rejects malformed filters', async () => {
    const { user } = await setup();
    const tooMany = Array.from({ length: 51 }, (_, i) => i + 1).join(',');
    for (const query of [
      'ids=0',
      'ids=a',
      'ids=1,',
      `ids=${tooMany}`,
      'favorite=yes',
      'hidden=1',
      'workspaceId=0',
      'pageSize=101',
    ]) {
      const result = await app.handle(
        new Request(`http://localhost/projects/search?${query}`, {
          headers: { cookie: user.cookie },
        }),
      );
      expect(result.status).toBe(400);
    }
  });
});
