import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';

// A project key is unique within its team. Routes name a project by its ref,
// "<teamRef>.<key>", or by the bare key while only one of the caller's teams has it.

async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

// An owner with two teams, each holding a project keyed MKT.
async function twoTeamsWithMkt() {
  const owner = await signUpClient();
  const first = (await owner.api.teams.get()).data![0];
  const second = (await owner.api.teams.post({ name: 'Second', slug: 'second' })).data!;
  const a = (await owner.api.projects.post({ key: 'MKT', name: 'First marketing' })).data!;
  const b = (
    await owner.api.teams({ teamId: second.id }).projects.post({
      key: 'MKT',
      name: 'Second marketing',
    })
  ).data!;
  return { owner, first, second, a, b };
}

describe('project ref', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lets two teams use the same key, and refuses it twice in one team', async () => {
    const { owner, second, a, b } = await twoTeamsWithMkt();
    expect(a.teamId).not.toBe(b.teamId);

    const dup = await owner.api.teams({ teamId: second.id }).projects.post({
      key: 'MKT',
      name: 'Again',
    });
    expect(dup.status).toBe(409);
  });

  it('carries the ref on the project', async () => {
    const { a } = await twoTeamsWithMkt();
    expect(a).toMatchObject({ teamRef: String(a.teamId), ref: `${a.teamId}.MKT` });
  });

  it("carries the ref on the team's project lists", async () => {
    const { owner, second } = await twoTeamsWithMkt();
    await owner.api.teams({ teamId: second.id }).patch({ slug: 'acme' });

    const page = await owner.api.teams({ teamId: second.id }).projects.get({ query: {} });
    expect(page.data?.items[0]).toMatchObject({ key: 'MKT', ref: 'acme.MKT' });
    const options = await owner.api.teams({ teamId: second.id }).projects.options.get();
    expect(options.data?.[0]).toMatchObject({ key: 'MKT', ref: 'acme.MKT' });
  });

  it('resolves a ref by team id and by team slug', async () => {
    const { owner, second, b } = await twoTeamsWithMkt();

    const byId = await owner.api.projects({ projectKey: `${second.id}.MKT` }).get();
    expect(byId.data?.project.id).toBe(b.id);

    await owner.api.teams({ teamId: second.id }).patch({ slug: 'acme' });
    const bySlug = await owner.api.projects({ projectKey: 'acme.MKT' }).get();
    expect(bySlug.data?.project).toMatchObject({ id: b.id, teamRef: 'acme', ref: 'acme.MKT' });
    expect((await owner.api.projects({ projectKey: `${second.id}.MKT` }).get()).status).toBe(200);
  });

  it('answers 404 for a ref whose team has no such project', async () => {
    const { owner, second } = await twoTeamsWithMkt();

    expect((await owner.api.projects({ projectKey: `${second.id}.OPS` }).get()).status).toBe(404);
    expect((await owner.api.projects({ projectKey: 'nope.MKT' }).get()).status).toBe(404);
  });

  it('refuses a bare key that names a project in several of the caller’s teams', async () => {
    const { owner } = await twoTeamsWithMkt();

    const res = await owner.api.projects({ projectKey: 'MKT' }).get();
    expect(res.status).toBe(409);
  });

  it('resolves a bare key to the one project among the caller’s teams', async () => {
    const { owner, b } = await twoTeamsWithMkt();
    const member = await addProjectMember(owner.api, `${b.teamId}.MKT`);

    const res = await member.projects({ projectKey: 'MKT' }).get();
    expect(res.status).toBe(200);
    expect(res.data?.project.id).toBe(b.id);
  });

  it('resolves a bare key while the instance has one project with it', async () => {
    const owner = await signUpClient();
    await owner.api.projects.post({ key: 'OPS', name: 'Ops' });

    expect((await owner.api.projects({ projectKey: 'OPS' }).get()).status).toBe(200);
  });

  it('rejects a key outside the allowed form', async () => {
    const { api } = await signUpClient();

    for (const key of ['mkt', '1MKT', 'MK-T', 'M.KT', 'ABCDEFGHIJK']) {
      expect((await api.projects.post({ key, name: 'Marketing' })).status).toBe(400);
    }
    expect((await api.projects.post({ key: 'ABCDEFGHIJ', name: 'Marketing' })).status).toBe(201);
  });
});
