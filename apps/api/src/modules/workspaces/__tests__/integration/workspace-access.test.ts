import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { readOnlyPermissions, setWorkspaceRoleGrant } from '#shared/workspace-roles';

// The owner and the admins of a workspace reach every team and project in it without
// being members: the owner as an owner, an admin with read access.

async function setup() {
  const owner = await signUpTestUser({ team: false });
  const lead = await signUpTestUser();
  const admin = await signUpTestUser();
  const outsider = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  const asLead = authedApi(lead.cookie);

  await asLead.projects.post({ key: 'MKT', name: 'Marketing' });
  const scaffold = (await asLead.projects({ projectKey: 'MKT' }).get()).data!;
  const workspaceId = (await asOwner.workspaces.get()).data!.find((w) => w.role === 'owner')!.id;
  await asOwner.workspaces({ workspaceId }).managers.post({ userId: admin.userId });

  return {
    owner,
    lead,
    admin,
    workspaceId,
    asOwner,
    asLead,
    asAdmin: authedApi(admin.cookie),
    asOutsider: authedApi(outsider.cookie),
    teamId: scaffold.project.teamId,
    columnId: scaffold.columns[0]!.id,
  };
}

function createIssue(api: Api, columnId: number) {
  return api.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' });
}

describe('workspace access', () => {
  beforeEach(resetDb);
  afterEach(() => setWorkspaceRoleGrant('admin', readOnlyPermissions()));

  it('lets the workspace owner work in every project as its owner', async () => {
    const { asOwner, teamId, columnId } = await setup();

    const listed = (await asOwner.projects.get()).data!;
    expect(listed).toEqual([
      expect.objectContaining({ key: 'MKT', role: 'owner', via: 'workspace' }),
    ]);
    const board = await asOwner.projects({ projectKey: 'MKT' }).get();
    expect(board.data!.viewer).toEqual({ role: 'owner', teamRole: 'owner', via: 'workspace' });
    expect((await createIssue(asOwner, columnId)).status).toBe(201);

    const teams = (await asOwner.teams.get()).data!;
    expect(teams.find((t) => t.id === teamId)).toMatchObject({ role: 'owner', via: 'workspace' });
    expect(
      (await asOwner.teams({ teamId }).patch({ name: 'Renamed', slug: 'renamed' })).status,
    ).toBe(200);
  });

  it('lets a workspace admin read every project and change nothing', async () => {
    const { asAdmin, teamId, columnId } = await setup();

    const listed = (await asAdmin.projects.get()).data!;
    expect(listed.find((p) => p.key === 'MKT')).toMatchObject({ role: 'member', via: 'workspace' });
    const board = (await asAdmin.projects({ projectKey: 'MKT' }).get()).data!;
    expect(board.viewer.via).toBe('workspace');
    expect(board.permissions.work_items).toEqual({
      create: false,
      edit: false,
      read: true,
      delete: false,
    });
    expect((await asAdmin.projects({ projectKey: 'MKT' }).issues.get()).status).toBe(200);
    expect((await createIssue(asAdmin, columnId)).status).toBe(403);

    const team = (await asAdmin.teams.get()).data!.find((t) => t.id === teamId);
    expect(team).toMatchObject({ role: 'member', via: 'workspace' });
    expect(
      (await asAdmin.teams({ teamId }).patch({ name: 'Renamed', slug: 'renamed' })).status,
    ).toBe(403);
    expect(
      (await asAdmin.projects({ projectKey: 'MKT' }).preferences.patch({ isFavorite: true }))
        .status,
    ).toBe(403);
  });

  it('shows a workspace admin every project of a team', async () => {
    const { asAdmin, teamId } = await setup();
    const page = (await asAdmin.teams({ teamId }).projects.get({ query: {} })).data!;
    expect(page.items.map((p) => p.key)).toEqual(['MKT']);
  });

  it('lets the workspace owner set ranks in a team and keeps its last owner', async () => {
    const { asOwner, asLead, lead, teamId } = await setup();
    const member = await signUpTestUser();
    const invite = await asLead
      .teams({ teamId })
      .invites.post({ email: member.email, role: 'member' });
    await authedApi(member.cookie).invites({ token: invite.data!.token }).accept.post();
    const team = asOwner.teams({ teamId });

    expect((await team.members({ userId: member.userId }).patch({ role: 'manager' })).status).toBe(
      204,
    );
    expect((await team.members({ userId: lead.userId }).patch({ role: 'member' })).status).toBe(
      409,
    );
    expect((await team.members({ userId: lead.userId }).delete()).status).toBe(409);
    expect((await team.members({ userId: member.userId }).delete()).status).toBe(204);
  });

  it('makes the workspace owner a member of the team they create a project in', async () => {
    const { asOwner, owner, teamId } = await setup();
    const created = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Ops' });
    expect(created.status).toBe(201);
    const team = (await asOwner.teams.get()).data!.find((t) => t.id === teamId);
    expect(team).toMatchObject({ role: 'owner', via: 'member' });
    const members = (await asOwner.teams({ teamId }).members.get()).data!;
    expect(members.items.map((m) => m.userId)).toContain(owner.userId);
  });

  it('adds neither of them to the members', async () => {
    const { asOwner, owner, admin } = await setup();
    const members = (await asOwner.projects({ projectKey: 'MKT' }).members.get({ query: {} }))
      .data!;
    const ids = members.items.map((m) => m.userId);
    expect(ids).not.toContain(owner.userId);
    expect(ids).not.toContain(admin.userId);
  });

  it('reaches nothing for someone who only has a team in the workspace', async () => {
    const { asOutsider } = await setup();
    expect((await asOutsider.projects.get()).data!.map((p) => p.key)).not.toContain('MKT');
    expect((await asOutsider.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
  });

  it('ends with the role in the workspace', async () => {
    const { asOwner, asAdmin, admin, workspaceId } = await setup();
    await asOwner.workspaces({ workspaceId }).managers({ userId: admin.userId }).delete();
    expect((await asAdmin.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
  });

  it('follows what a build grants a role', async () => {
    const { asAdmin, columnId } = await setup();
    setWorkspaceRoleGrant('admin', 'owner');
    expect((await createIssue(asAdmin, columnId)).status).toBe(201);
    setWorkspaceRoleGrant('admin', null);
    expect((await asAdmin.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
  });
});
