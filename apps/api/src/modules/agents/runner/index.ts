import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { runnerAuth } from '../runner-auth';
import { ClaimResponse, resultBody, runParams } from './model';
import { claimRunnerRun, finishRun, heartbeatRun } from './service';

// The queue an external agent's runner drains, authenticated with the agent's own
// API key.
export const agentRunnerRoutes = new Elysia({
  name: 'agent-runner',
  detail: { tags: ['Agent Runner'] },
})
  .use(runnerAuth)

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
      const ok = await finishRun(agent, params.runId, body);
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
