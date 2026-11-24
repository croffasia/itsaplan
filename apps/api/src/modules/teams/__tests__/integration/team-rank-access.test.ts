import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';

// An owner and a manager of a team reach its projects without being members of them: the
// owner as an owner, the manager with read access.

type Rank = 'owner' | 'manager' | 'member';

async function setup() {
  const founder = await signUpTestUser();
  const asFounder = authedApi(founder.cookie);
  await createProject(asFounder, { key: 'MKT', name: 'Marketing' });
  const scaffold = (await asFounder.projects({ projectKey: 'MKT' }).get()).data!;
  const teamId = scaffold.project.teamId;
  const columnId = scaffold.columns[0]!.id;
  const issue = (await createIssue(asFounder, columnId)).data!;

  const join = async (role: Rank) => {
    const user = await signUpTestUser({ team: false });
    const invite = await asFounder.teams({ teamId }).invites.post({ email: user.email, role });
    const client = authedApi(user.cookie);
    await client.invites({ token: invite.data!.token }).accept.post();
    return { userId: user.userId, client };
  };
  return { asFounder, teamId, columnId, issue, projectId: scaffold.project.id, join };
}

function createIssue(api: Api, columnId: number) {
  return api.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' });
}

describe('access by a rank in the team', () => {
  beforeEach(resetDb);

  it('lets a team owner act as an owner of a project they are not in', async () => {
    const { columnId, issue, join } = await setup();
    const { client } = await join('owner');

    expect((await client.projects.get()).data).toMatchObject([
      { key: 'MKT', role: 'owner', via: 'team' },
    ]);
    const project = client.projects({ projectKey: 'MKT' });
    expect((await project.get()).data!.viewer).toMatchObject({ role: 'owner', via: 'team' });
    expect((await createIssue(client, columnId)).status).toBe(201);
    expect((await client.issues({ issueId: issue.id }).patch({ title: 'Renamed' })).status).toBe(
      200,
    );
    const column = { name: 'Review', stateType: 'started' as const };
    expect((await project.columns.post(column)).status).toBe(201);
  });

  it('lets a manager read everything in a project they are not in, and change nothing', async () => {
    const { columnId, issue, projectId, teamId, join } = await setup();
    const { client } = await join('manager');

    expect((await client.projects.get()).data).toMatchObject([
      { key: 'MKT', role: 'member', via: 'team' },
    ]);
    const scaffold = (await client.projects({ projectKey: 'MKT' }).get()).data!;
    expect(scaffold.permissions).toMatchObject({
      work_items: { read: true, create: false, edit: false, delete: false },
      ai_agents: { read: true, create: false, edit: false },
    });
    expect((await client.issues({ issueId: issue.id }).get()).status).toBe(200);
    expect(
      (await client.teams({ teamId }).projects({ projectId }).get()).data!.viewer,
    ).toMatchObject({ role: 'member', via: 'team' });
    expect((await createIssue(client, columnId)).status).toBe(403);
    expect((await client.issues({ issueId: issue.id }).patch({ title: 'Renamed' })).status).toBe(
      403,
    );
  });

  it('leaves a plain member of the team to the projects they joined', async () => {
    const { issue, join } = await setup();
    const { client } = await join('member');

    expect((await client.projects.get()).data).toEqual([]);
    expect((await client.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
    expect((await client.issues({ issueId: issue.id }).get()).status).toBe(403);
  });

  it("raises a manager's narrow project role to reading the whole project", async () => {
    const { asFounder, columnId, issue, join } = await setup();
    const { userId, client } = await join('manager');
    const role = (
      await createRole(asFounder, 'MKT', {
        name: 'Docs only',
        permissions: { documents: { read: true, create: true } },
      })
    ).data!;
    await asFounder
      .projects({ projectKey: 'MKT' })
      .members.post({ userId, role: 'member', roleId: role.id });

    const scaffold = (await client.projects({ projectKey: 'MKT' }).get()).data!;
    expect(scaffold.viewer).toMatchObject({ role: 'member', via: 'member' });
    expect(scaffold.permissions).toMatchObject({
      documents: { read: true, create: true },
      work_items: { read: true, create: false },
    });
    expect((await client.issues({ issueId: issue.id }).get()).status).toBe(200);
    expect((await createIssue(client, columnId)).status).toBe(403);
  });

  it('keeps them out of the member list, and ends with the rank', async () => {
    const { asFounder, teamId, projectId, join } = await setup();
    const { userId, client } = await join('manager');

    const members = await asFounder.projects({ projectKey: 'MKT' }).members.get({ query: {} });
    expect(members.data!.items.map((member) => member.userId)).not.toContain(userId);
    const view = { name: 'Mine', isPrivate: true };
    expect((await client.projects({ projectKey: 'MKT' }).views.post(view)).status).toBe(403);
    const scope = `board:${projectId}`;
    const marker = async () =>
      (await client.sync.rev.get({ query: { scopes: scope } })).data!.revs[scope];
    expect(await marker()).not.toBe('0');

    await asFounder.teams({ teamId }).members({ userId }).patch({ role: 'member' });

    expect((await client.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
    expect(await marker()).toBe('0');
  });
});
