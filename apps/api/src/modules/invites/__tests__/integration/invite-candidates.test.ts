import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setInviteEmailPolicy } from '#modules/invites/email-policy';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { createAgent } from '#tests/helpers/agents';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function ownTeamId(api: Api): Promise<number> {
  const teams = await api.teams.get();
  return teams.data!.find((one) => one.role === 'owner')!.id;
}

// The first account is the instance owner, so it may set the search in god mode.
async function setupOwner(inviteSearch = true) {
  const owner = await signUpTestUser({ name: 'Olivia Owner', email: 'olivia@owner.test' });
  const api = authedApi(owner.cookie);
  await api.god['auth-settings'].put({ inviteSearch });
  return { api, teamId: await ownTeamId(api) };
}

async function joinTeam(
  owner: Awaited<ReturnType<typeof setupOwner>>,
  role: 'manager' | 'member',
  person: { name: string; email: string },
) {
  const user = await signUpTestUser(person);
  const invite = await owner.api
    .teams({ teamId: owner.teamId })
    .invites.post({ email: user.email, role });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return api;
}

const search = (api: Api, teamId: number, term: string) =>
  api.teams({ teamId }).invites.candidates.get({ query: { search: term } });

const emails = (items: { email: string }[] | null) => (items ?? []).map((one) => one.email);

describe('invite candidates — GET /teams/:teamId/invites/candidates', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    setInviteEmailPolicy();
  });

  it('is refused while the instance has the search off, which is the default', async () => {
    const owner = await setupOwner(false);
    await signUpTestUser({ name: 'Nina New', email: 'nina@new.test' });

    expect((await search(owner.api, owner.teamId, 'nina')).status).toBe(403);
    expect((await owner.api.settings['invite-search'].get()).data).toEqual({ enabled: false });

    await owner.api.god['auth-settings'].put({ inviteSearch: true });
    expect((await owner.api.settings['invite-search'].get()).data).toEqual({ enabled: true });
    expect(emails((await search(owner.api, owner.teamId, 'nina')).data)).toEqual(['nina@new.test']);
  });

  it('matches part of the name or the address, ignoring case', async () => {
    const owner = await setupOwner();
    const ada = await signUpTestUser({ name: 'Ada Lovelace', email: 'ada@engine.test' });
    await signUpTestUser({ name: 'Grace Hopper', email: 'grace@navy.test' });

    const byName = await search(owner.api, owner.teamId, 'LOVE');
    expect(byName.status).toBe(200);
    expect(byName.data).toEqual([
      { userId: ada.userId, name: 'Ada Lovelace', email: 'ada@engine.test', image: null },
    ]);

    const byEmail = await search(owner.api, owner.teamId, 'navy.te');
    expect(emails(byEmail.data)).toEqual(['grace@navy.test']);
  });

  it('leaves out the members of the team and the AI agents', async () => {
    const owner = await setupOwner();
    await joinTeam(owner, 'member', { name: 'Sam Member', email: 'sam@crew.test' });
    await signUpTestUser({ name: 'Sam Outsider', email: 'sam@elsewhere.test' });
    const other = await signUpTestUser({ name: 'Other Owner', email: 'other@owner.test' });
    const otherApi = authedApi(other.cookie);
    await createProject(otherApi, { key: 'OTH', name: 'Other' });
    const agent = await createAgent(otherApi, 'OTH', {
      name: 'Sam Bot',
      username: 'sambot',
      kind: 'external',
    });
    expect(agent.status).toBe(201);

    const res = await search(owner.api, owner.teamId, 'sam');
    expect(emails(res.data)).toEqual(['sam@elsewhere.test']);
    expect(emails((await search(owner.api, owner.teamId, 'olivia')).data)).toEqual([]);
  });

  it('leaves out the people the invite policy refuses', async () => {
    const owner = await setupOwner();
    for (let i = 1; i <= 9; i++) {
      await signUpTestUser({ name: `Crowd ${i}`, email: `crowd-${i}@outside.test` });
    }
    await signUpTestUser({ name: 'Crowd Inside', email: 'crowd@inside.test' });
    setInviteEmailPolicy(async (_teamId, email) => email.endsWith('@inside.test'));

    const res = await search(owner.api, owner.teamId, 'crowd');
    expect(emails(res.data)).toEqual(['crowd@inside.test']);
  });

  it('answers with at most 8 people', async () => {
    const owner = await setupOwner();
    for (let i = 1; i <= 9; i++) {
      await signUpTestUser({ name: `Crowd ${i}`, email: `crowd-${i}@many.test` });
    }

    const res = await search(owner.api, owner.teamId, 'crowd');
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(8);
  });

  it('needs at least 2 characters', async () => {
    const owner = await setupOwner();
    await signUpTestUser({ name: 'Al Short', email: 'al@short.test' });

    expect((await search(owner.api, owner.teamId, 'a')).status).toBe(400);
    expect((await search(owner.api, owner.teamId, '')).status).toBe(400);
    expect(emails((await search(owner.api, owner.teamId, 'al')).data)).toEqual(['al@short.test']);
  });

  it('matches % and _ literally', async () => {
    const owner = await setupOwner();
    await signUpTestUser({ name: 'Rate 100% Sure', email: 'percent@chars.test' });
    await signUpTestUser({ name: 'Rate 1000 Sure', email: 'digits@chars.test' });
    await signUpTestUser({ name: 'snake_case', email: 'underscore@chars.test' });
    await signUpTestUser({ name: 'snakeXcase', email: 'letter@chars.test' });

    expect(emails((await search(owner.api, owner.teamId, '100%')).data)).toEqual([
      'percent@chars.test',
    ]);
    expect(emails((await search(owner.api, owner.teamId, 'e_c')).data)).toEqual([
      'underscore@chars.test',
    ]);
  });

  it('is open to a manager and refused to a plain member', async () => {
    const owner = await setupOwner();
    const manager = await joinTeam(owner, 'manager', {
      name: 'Mia Manager',
      email: 'mia@crew.test',
    });
    const member = await joinTeam(owner, 'member', { name: 'Max Member', email: 'max@crew.test' });
    await signUpTestUser({ name: 'Nina New', email: 'nina@new.test' });

    const byManager = await search(manager, owner.teamId, 'nina');
    expect(emails(byManager.data)).toEqual(['nina@new.test']);

    const byMember = await search(member, owner.teamId, 'nina');
    expect(byMember.status).toBe(403);
  });
});
