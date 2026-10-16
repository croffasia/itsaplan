import { beforeEach, describe, expect, it } from 'bun:test';
import { db, project } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function waitForBlockedRequests(count: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const [row] = await db.execute(sql`
      SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `);
    if (Number(row.count) >= count) return;
    await Bun.sleep(10);
  }
  throw new Error(`Expected ${count} requests waiting on the project lock`);
}

describe('requests during project transfers', () => {
  beforeEach(resetDb);

  it('rejects an action validated before a transfer but queued behind it', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const source = (await api.projects.post({ key: 'MOVE', name: 'Project' })).data!;
    const target = (await api.teams.post({ name: 'Destination', slug: 'destination' })).data!;
    let unlock!: () => void;
    let signalLocked!: () => void;
    const release = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const holding = db.transaction(async (tx) => {
      // Queue the transfer first, then let the action's authorization read the old owner.
      await tx
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, source.id))
        .for('update');
      signalLocked();
      await release;
    });
    await locked;
    const move = api.projects({ projectKey: source.ref }).transfer.post({
      projectId: source.id,
      sourceTeamId: source.teamId,
      targetTeamId: target.id,
    });
    let action: ReturnType<ReturnType<typeof api.projects>['actions']['post']> | undefined;
    try {
      await waitForBlockedRequests(1);
      action = api.projects({ projectKey: source.ref }).actions.post({
        name: 'Stale action',
        effect: { sourceTeamId: source.teamId },
      });
      await waitForBlockedRequests(2);
      unlock();
      expect((await move).status).toBe(200);
      expect((await action).status).toBe(409);
      expect((await api.projects({ projectKey: 'destination.MOVE' }).actions.get()).data).toEqual(
        [],
      );
      const fresh = await api
        .projects({ projectKey: 'destination.MOVE' })
        .actions.post({ name: 'Fresh action' });
      expect(fresh.status).toBe(201);
      expect(
        (await api.projects({ projectKey: 'destination.MOVE' }).actions.get()).data,
      ).toMatchObject([{ name: 'Fresh action' }]);
    } finally {
      unlock();
      await Promise.allSettled([holding, move, action]);
    }
  });

  it.each(['team', 'project'] as const)(
    'rejects a stale %s deletion queued behind a transfer',
    async (route) => {
      const owner = await signUpTestUser();
      const api = authedApi(owner.cookie);
      const source = (await api.projects.post({ key: 'MOVE', name: 'Project' })).data!;
      const target = (await api.teams.post({ name: 'Destination', slug: 'destination' })).data!;
      let unlock!: () => void;
      let signalLocked!: () => void;
      const release = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const locked = new Promise<void>((resolve) => {
        signalLocked = resolve;
      });
      const holding = db.transaction(async (tx) => {
        await tx
          .select({ id: project.id })
          .from(project)
          .where(eq(project.id, source.id))
          .for('update');
        signalLocked();
        await release;
      });
      await locked;
      const move = api.projects({ projectKey: source.ref }).transfer.post({
        projectId: source.id,
        sourceTeamId: source.teamId,
        targetTeamId: target.id,
      });
      let deletion: PromiseLike<unknown> | undefined;
      try {
        await waitForBlockedRequests(1);
        const request =
          route === 'team'
            ? api.teams({ teamId: source.teamId }).projects({ projectId: source.id }).delete()
            : api.projects({ projectKey: source.ref }).delete();
        deletion = request;
        await waitForBlockedRequests(2);
        unlock();
        expect((await move).status).toBe(200);
        expect((await request).status).toBe(409);
        expect(
          (await api.projects({ projectKey: 'destination.MOVE' }).get()).data?.project,
        ).toMatchObject({ id: source.id, teamId: target.id });
        expect(
          (await api.teams({ teamId: target.id }).projects({ projectId: source.id }).delete())
            .status,
        ).toBe(204);
      } finally {
        unlock();
        await Promise.allSettled([holding, move, deletion]);
      }
    },
  );
});
