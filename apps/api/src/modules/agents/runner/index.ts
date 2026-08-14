import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { ClaimResponse, resultBody, runParams } from './model';
import { claimRunnerRun, finishRun, getRunnerAgent, heartbeatRun } from './service';

// The queue an external agent's runner drains, authenticated with the agent's own
// API key.
export const agentRunnerRoutes = new Elysia({
  name: 'agent-runner',
  detail: { tags: ['Agent Runner'] },
})
  .use(authContext)
  // Resolves the agent from the caller's key, so a runner can only ever reach its own
  // runs. Set `runnerAgent: true` in the route options and read `agent` in the handler.
  .macro({
    runnerAgent(_enabled: boolean) {
      return {
        async resolve({ user }) {
          const agent = await getRunnerAgent(requireUser(user).id);
          if (!agent) throw new HttpError(403, 'Only an agent key can claim runs');
          if (agent.kind !== 'external') throw new HttpError(403, 'Internal agents run in-process');
          return { agent };
        },
      };
    },
  })

  .post('/agent-runs/claim', async ({ agent }) => ({ run: await claimRunnerRun(agent) }), {
    runnerAgent: true,
    response: { 200: ClaimResponse, ...errors(401, 403) },
    detail: {
      summary: 'Claim the next run',
      description:
        "Take the calling agent's next queued run, or run: null when it has none. It is " +
        'leased: report a result or send heartbeats, otherwise it is handed out again.',
    },
  })

  .post(
    '/agent-runs/:runId/heartbeat',
    async ({ agent, params }) => {
      const ok = await heartbeatRun(agent.id, params.runId);
      if (!ok) throw new HttpError(404, 'Run not found');
      return noContent();
    },
    {
      runnerAgent: true,
      params: runParams,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Extend a run lease',
        description: 'Keep a claimed run leased while the runner is still working on it.',
      },
    },
  )

  .post(
    '/agent-runs/:runId/result',
    async ({ agent, params, body }) => {
      const ok = await finishRun(agent.id, params.runId, body);
      if (!ok) throw new HttpError(404, 'Run not found');
      return noContent();
    },
    {
      runnerAgent: true,
      params: runParams,
      body: resultBody,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Report a run result',
        description: 'Finish a claimed run as success or failed. A failure is not retried.',
      },
    },
  );
