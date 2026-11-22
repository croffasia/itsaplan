import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { runnerAuth } from '../runner-auth';
import {
  ClaimResponse,
  heartbeatBody,
  resultBody,
  RunAckResponse,
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
    response: { 200: ClaimResponse, ...errors(401, 403, 409) },
    detail: {
      summary: 'Claim the next run',
      description:
        "Take the calling agent's next queued run, or run: null when it has none. It is " +
        'leased: report a result or send heartbeats, otherwise it is handed out again. ' +
        '409 for an agent with an invocation URL, whose runs are sent to that URL.',
    },
  })

  .post(
    '/agent-runs/:runId/heartbeat',
    async ({ agent, params, body }) => {
      const ack = await heartbeatRun(agent.id, params.runId, body?.attempt);
      if (!ack) throw new HttpError(404, 'Run not found');
      return ack;
    },
    {
      runnerAgent: true,
      params: runParams,
      body: heartbeatBody,
      response: { 200: RunAckResponse, ...commonErrors },
      detail: {
        summary: 'Extend a run lease',
        description:
          'Keep a claimed run leased while the runner is still working on it. Answers ' +
          '`canceled` when someone stopped the run, which is how a runner writing nothing ' +
          'learns of it.',
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
          'Ordered, idempotent event batches for the current leased attempt. Session ids name ' +
          'local Codex threads. Answers `canceled` when someone stopped the run: kill the ' +
          'command and stop reporting.',
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
