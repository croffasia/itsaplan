import { beforeEach, describe, expect, it } from 'bun:test';
import { db, projectMember, teamInvite, agentSchedule, agentRun } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { pgErrorCode } from '#shared/lib';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  const source = (await api.projects.post({ key: 'MOVE', name: 'Project' })).data!;
  const target = (await api.teams.post({ name: 'Destination', slug: 'destination' })).data!;
  const agent = (
    await api.teams({ teamId: source.teamId })['ai-agents'].post({
      name: 'Worker',
      username: 'worker',
      kind: 'external',
      projectIds: [],
    })
  ).data!.agent;
  const sourceRole = (await api.teams({ teamId: source.teamId }).roles.options.get()).data![0];
  expect(
    (
      await api.projects({ projectKey: source.ref }).transfer.post({
        projectId: source.id,
        sourceTeamId: source.teamId,
        targetTeamId: target.id,
      })
    ).status,
  ).toBe(200);
  return { owner, api, source, target, agent, sourceRole };
}

async function expectConflict(write: () => Promise<unknown>) {
  // Simulate a writer whose API validation happened before the transfer. Its
  // database commit must independently reject the now-stale team reference.
  let error: unknown;
  try {
    await write();
  } catch (caught) {
    error = caught;
  }
  expect(pgErrorCode(error)).toBe('40001');
}

describe('project transfer database boundaries', () => {
  beforeEach(resetDb);

  it('rejects a late source-agent membership and a source-role update', async () => {
    const { owner, api, source, target, agent, sourceRole } = await setup();
    await expectConflict(async () =>
      db.insert(projectMember).values({
        projectId: source.id,
        userId: agent.userId,
        role: 'member',
        roleId: null,
      }),
    );
    await expectConflict(async () =>
      db
        .update(projectMember)
        .set({ roleId: sourceRole.id })
        .where(and(eq(projectMember.projectId, source.id), eq(projectMember.userId, owner.userId))),
    );
    const members = (
      await api.teams({ teamId: target.id }).projects({ projectId: source.id }).members.get()
    ).data!.items;
    expect(members.some((m) => m.userId === agent.userId)).toBe(false);
    expect(members.find((m) => m.userId === owner.userId)).toMatchObject({
      role: 'owner',
      roleId: null,
    });
  });

  it('rejects a late source-team invitation', async () => {
    const { api, source, target } = await setup();
    await expectConflict(async () =>
      db.insert(teamInvite).values({
        teamId: source.teamId,
        projectId: source.id,
        email: 'late@example.com',
        projectRole: 'member',
      }),
    );
    expect((await api.teams({ teamId: target.id }).invites.get()).data).toEqual([]);
  });

  it('rejects late source-agent schedules and pending runs', async () => {
    const { source, agent } = await setup();
    await expectConflict(async () =>
      db.insert(agentSchedule).values({
        agentId: agent.id,
        projectId: source.id,
        name: 'Late schedule',
        prompt: 'Task',
        cron: '* * * * *',
        timezone: 'UTC',
        nextRunAt: new Date(),
      }),
    );
    await expectConflict(async () =>
      db.insert(agentRun).values({
        agentId: agent.id,
        projectId: source.id,
        trigger: 'manual',
        prompt: 'Task',
      }),
    );
  });
});
