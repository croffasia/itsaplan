import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { runnerAuth } from '../runner-auth';
import {
  ClaimResponse,
  heartbeatBody,
  resultBody,
  runParams,
  runEventsBody,
  RunEventsAck,
} from './model';
import { claimRunnerRun, finishRun, heartbeatRun } from './service';
import { appendRunEvents } from './run-events';

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
    async ({ agent, params, body }) => {
      const ok = await heartbeatRun(agent.id, params.runId, body?.attempt);
      if (!ok) throw new HttpError(404, 'Run not found');
      return noContent();
    },
    {
      runnerAgent: true,
      params: runParams,
      body: heartbeatBody,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Extend a run lease',
        description: 'Keep a claimed run leased while the runner is still working on it.',
      },
    },
  )

  .post(
    '/agent-runs/:runId/events',
    ({ agent, params, body }) => appendRunEvents(agent.id, params.runId, body),
    {
      runnerAgent: true,
      params: runParams,
      body: runEventsBody,
      response: { 200: RunEventsAck, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Append external run events',
        description:
          'Ordered, idempotent event batches for the current leased attempt. Session ids name local Codex threads.',
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
