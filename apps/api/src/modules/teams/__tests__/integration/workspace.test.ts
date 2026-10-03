import { beforeEach, describe, expect, it } from 'bun:test';
import { db, team, workspace, workspaceManager } from '@repo/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';

describe('instance workspace', () => {
  beforeEach(resetDb);

  it('makes the first account its owner and nobody else a manager', async () => {
    const first = await signUpTestUser({ team: false });
    await signUpTestUser({ team: false });

    const managers = await db.select().from(workspaceManager);
    expect(managers).toHaveLength(1);
    expect(managers[0]).toMatchObject({ userId: first.userId, role: 'owner' });
  });

  it('puts every new team in it', async () => {
    await signUpTestUser();
    await signUpTestUser();
    const [managed] = await db.select().from(workspaceManager);

    const teams = await db.select({ workspaceId: team.workspaceId }).from(team);
    expect(teams).toEqual([
      { workspaceId: managed!.workspaceId },
      { workspaceId: managed!.workspaceId },
    ]);
  });

  it('lets only the workspace owner create a team', async () => {
    const owner = await signUpTestUser({ team: false });
    const member = await signUpTestUser({ team: false });

    const refused = await authedApi(member.cookie).teams.post({ name: 'Design', slug: 'design' });
    const created = await authedApi(owner.cookie).teams.post({ name: 'Design', slug: 'design' });

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
