import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { app, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';

// GET /initiatives/search: title search over every project the caller may read
// initiatives in.

async function setup() {
  await signUpTestUser();
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  await createProject(api, { key: 'OPS', name: 'Operations' });
  return { user, api };
}

async function createInitiative(api: Api, projectKey: string, title: string) {
  const res = await api.projects({ projectKey }).initiatives.post({ title });
  return res.data!;
}

async function projectId(api: Api, projectKey: string) {
  return (await api.projects({ projectKey }).get()).data!.project.id;
}

function search(api: Api, query: { q: string; projectId?: number }) {
  return api.initiatives.search.get({ query });
}

const titles = (res: Awaited<ReturnType<typeof search>>) => res.data?.map((hit) => hit.title);

describe('initiative search', () => {
  beforeEach(resetDb);
  afterEach(clearLimits);

  it('matches titles in every project of the caller, newest first, each with its project', async () => {
    const { api } = await setup();
    const launch = await createInitiative(api, 'MKT', 'Zephyr launch');
    await createInitiative(api, 'OPS', 'zephyr rollout');
    await createInitiative(api, 'OPS', 'Unrelated');

    const res = await search(api, { q: 'ZEPHYR' });
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['zephyr rollout', 'Zephyr launch']);
    expect(res.data![1]).toEqual({
      id: launch.id,
      title: 'Zephyr launch',
      projectId: launch.projectId,
      projectRef: expect.stringMatching(/\.MKT$/),
      projectKey: 'MKT',
    });

    await api.initiatives({ initiativeId: launch.id }).patch({ title: 'Zephyr launch v2' });
    expect(titles(await search(api, { q: 'zephyr' }))).toEqual([
      'Zephyr launch v2',
      'zephyr rollout',
    ]);
  });

  it('matches a typed wildcard as that character', async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Grow 50% faster');
    await createInitiative(api, 'MKT', 'Grow 50 accounts');

    expect(titles(await search(api, { q: '50%' }))).toEqual(['Grow 50% faster']);
  });

  it('narrows to one project with projectId', async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Shared goal');
    await createInitiative(api, 'OPS', 'Shared goal ops');

    const mkt = await projectId(api, 'MKT');
    expect(titles(await search(api, { q: 'shared', projectId: mkt }))).toEqual(['Shared goal']);
  });

  it("leaves out another person's projects, also when named by projectId", async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Secret plan');
    const mkt = await projectId(api, 'MKT');
    const other = authedApi((await signUpTestUser()).cookie);

    expect((await search(other, { q: 'secret' })).data).toEqual([]);
    expect((await search(other, { q: 'secret', projectId: mkt })).data).toEqual([]);
  });

  it('leaves out a project whose role may not read initiatives', async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Shared plan');
    await createInitiative(api, 'OPS', 'Shared runbook');
    const reader = await createRole(api, 'MKT', {
      name: 'Reader',
      permissions: { initiatives: { read: true } },
    });
    const issuesOnly = await createRole(api, 'OPS', {
      name: 'Issues only',
      permissions: { work_items: { read: true } },
    });
    const asReader = await addProjectMember(api, 'MKT', reader.data!.id);
    const asIssuesOnly = await addProjectMember(api, 'OPS', issuesOnly.data!.id);

    expect(titles(await search(asReader, { q: 'shared' }))).toEqual(['Shared plan']);
    expect((await search(asIssuesOnly, { q: 'shared' })).data).toEqual([]);
  });

  it('leaves out a project with initiatives turned off', async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Quiet plan');
    await createInitiative(api, 'OPS', 'Quiet runbook');
    await api.projects({ projectKey: 'OPS' }).settings.patch({ features: { initiatives: false } });

    expect(titles(await search(api, { q: 'quiet' }))).toEqual(['Quiet plan']);
  });

  it('leaves out a workspace whose limits block initiatives, whatever the project stored', async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Paid plan');
    setLimits({ blockedFeatures: ['initiatives'] });

    expect((await search(api, { q: 'paid' })).data).toEqual([]);
  });

  it('finds the initiatives of an archived project only when it is named', async () => {
    const { api } = await setup();
    await createInitiative(api, 'MKT', 'Old plan');
    const mkt = (await api.projects({ projectKey: 'MKT' }).get()).data!.project;
    await api.teams({ teamId: mkt.teamId }).projects({ projectId: mkt.id }).archive.post();

    expect((await search(api, { q: 'old' })).data).toEqual([]);
    expect(titles(await search(api, { q: 'old', projectId: mkt.id }))).toEqual(['Old plan']);
  });

  it('returns the 20 most recently updated hits', async () => {
    const { api } = await setup();
    for (let i = 1; i <= 21; i++) await createInitiative(api, 'MKT', `Goal ${i}`);

    const hits = titles(await search(api, { q: 'goal' }));
    expect(hits).toHaveLength(20);
    expect(hits).not.toContain('Goal 1');
  });

  it('rejects an empty query', async () => {
    const { user } = await setup();
    const res = await app.handle(
      new Request('http://localhost/initiatives/search?q=', { headers: { cookie: user.cookie } }),
    );
    expect(res.status).toBe(400);
  });
});
