import { beforeEach, describe, expect, it } from 'bun:test';
import { setAuthSettings } from '@repo/auth';
import { db, team, workspace, workspaceManager } from '@repo/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';

describe('the workspace of a team', () => {
  beforeEach(resetDb);

  it('gives every account, the instance owner included, a workspace of its own', async () => {
    const first = await signUpTestUser({ team: false });
    const second = await signUpTestUser({ team: false });

    const managers = await db.select().from(workspaceManager);
    expect(managers).toHaveLength(2);
    expect(managers).toContainEqual(
      expect.objectContaining({ userId: first.userId, role: 'owner' }),
    );
    expect(managers).toContainEqual(
      expect.objectContaining({ userId: second.userId, role: 'owner' }),
    );
    expect(first.workspaceId).not.toBe(second.workspaceId);
  });

  it('gives the instance owner one while personal workspaces are off', async () => {
    await setAuthSettings({ personalWorkspaces: false });

    const first = await signUpTestUser({ team: false });
    const second = await signUpTestUser({ team: false });

    expect(first.workspaceId).not.toBeNull();
    expect(second.workspaceId).toBeNull();
  });

  it("puts each person's team in their own workspace", async () => {
    const first = await signUpTestUser();
    const second = await signUpTestUser();

    const teams = await db.select({ workspaceId: team.workspaceId }).from(team);
    expect(teams.map((row) => row.workspaceId).sort()).toEqual(
      [first.workspaceId!, second.workspaceId!].sort(),
    );
  });

  it('refuses a team that names no workspace', async () => {
    const owner = await signUpTestUser({ team: false });

    const refused = await authedApi(owner.cookie).teams.post({
      name: 'Design',
      slug: 'design',
    } as never);

    expect(refused.status).toBe(400);
  });

  it('lets only the workspace owner create a team', async () => {
    const owner = await signUpTestUser({ team: false });
    const member = await signUpTestUser({ team: false });
    const body = { name: 'Design', slug: 'design', workspaceId: owner.workspaceId! };

    const refused = await authedApi(member.cookie).teams.post(body);
    const created = await authedApi(owner.cookie).teams.post(body);

    expect(refused.status).toBe(403);
    expect(created.status).toBe(201);
  });

  it('refuses a team in a workspace the caller does not own', async () => {
    const owner = await signUpTestUser({ team: false });
    const [other] = await db.insert(workspace).values({ name: 'Other' }).returning();

    const refused = await authedApi(owner.cookie).teams.post({
      name: 'Design',
      slug: 'design',
      workspaceId: other!.id,
    });

    expect(refused.status).toBe(403);
  });
});
