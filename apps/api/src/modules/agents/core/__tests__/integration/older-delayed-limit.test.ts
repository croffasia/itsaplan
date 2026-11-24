import { beforeEach, describe, expect, it } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { claimDueRuns, enqueueAgentRun, markRunExecuting, scheduleRunRetry } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';

describe('older delayed workspace limit regression', () => {
  beforeEach(resetDb);

  for (const retry of [false, true])
    it(`keeps an older delayed run queued during newer ${retry ? 'retry backoff' : 'execution'}`, async () => {
      const owner = await signUpTestUser({ name: 'Review fixture' });
      const api = authedApi(owner.cookie);
      expect((await createProject(api, { key: 'MKT', name: 'Review fixture' })).status).toBe(201);
      expect(
        (await api.workspaces({ workspaceId: owner.workspaceId! }).patch({ maxConcurrentRuns: 1 }))
          .status,
      ).toBe(200);
      const project = await api.projects({ projectKey: 'MKT' }).get();
      expect(project.status).toBe(200);
      const createdAgent = await createAgent(api, 'MKT', {
        name: 'Bot',
        username: 'bot',
        kind: 'internal',
      });
      expect(createdAgent.status).toBe(201);
      const agent = createdAgent.data!.agent;
      const makeIssue = async (title: string) => {
        const response = await api
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId: project.data!.columns[0].id, title });
        expect(response.status).toBe(201);
        return response.data!;
      };
      const olderIssue = await makeIssue('Older delayed run');
      await enqueueAgentRun({
        agentId: agent.id,
        projectId: agent.projects[0].id,
        issueId: olderIssue.id,
        sourceActivityId: null,
        prompt: 'Older delayed run',
        delaySeconds: 3600,
      });
      const newerIssue = await makeIssue('Newer immediate run');
      await enqueueAgentRun({
        agentId: agent.id,
        projectId: agent.projects[0].id,
        issueId: newerIssue.id,
        sourceActivityId: null,
        prompt: 'Newer immediate run',
      });
      const queue = () => api['agent-runs'].queue.get({ query: {} });
      const initial = await queue();
      expect(initial.status).toBe(200);
      const older = initial.data!.items.find((run) => run.issueId === olderIssue.id)!;
      const newer = initial.data!.items.find((run) => run.issueId === newerIssue.id)!;
      expect(older.id).toBeLessThan(newer.id);
      const claims = await claimDueRuns();
      expect(claims.map((run) => run.id)).toEqual([newer.id]);
      expect(await markRunExecuting(newer.id, claims[0].attempts)).toBe(true);
      if (retry) await scheduleRunRetry(newer.id, 60_000, 'model unavailable');

      // Advance only the delayed fixture's queue clock, as existing run-limit tests do.
      await db
        .update(agentRun)
        .set({ nextAttemptAt: sql`now()` })
        .where(eq(agentRun.id, older.id));
      await processAgentRuns();
      const after = await queue();
      expect(after.status).toBe(200);
      const observedOlder = after.data!.items.find((run) => run.id === older.id)!;
      const observedNewer = after.data!.items.find((run) => run.id === newer.id)!;
      const flight = await api.projects({ projectKey: 'MKT' })['agent-runs']['in-flight'].get();
      expect(flight.status).toBe(200);
      expect(flight.data).toMatchObject({ running: 1, limit: 1 });
      expect(observedNewer.executionState).toBe(retry ? 'queued' : 'running');
      expect(observedOlder).toMatchObject({ status: 'pending', attempts: 0, lastError: null });
    });
});
