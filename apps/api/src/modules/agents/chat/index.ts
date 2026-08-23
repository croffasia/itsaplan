import { Elysia, t } from 'elysia';
import { setTimeout as sleep } from 'node:timers/promises';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { noContent, sseFrame, sseResponse } from '#shared/http';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { getAgentById, isTriggerableBy } from '../core/service';
import { runnerAuth } from '../runner-auth';
import {
  ChatAckResponse,
  ChatEventsResponse,
  ClaimChatResponse,
  SendChatResponse,
  agentParams,
  chatEventsBody,
  chatEventsQuery,
  chatMessageParams,
  chatResultBody,
  runnerMessageParams,
  sendChatBody,
  type AgUiEventBody,
  type ChatMessageStatus,
} from './model';
import {
  agentChatConfig,
  appendEvents,
  cancelMessage,
  claimNextMessage,
  finishMessage,
  heartbeatMessage,
  readEvents,
  sendMessage,
  setThreadSession,
} from './service';

// Chatting with an external agent: the member's side (send a message, follow the
// answer) and the runner's side (take the next answer to produce, report AG-UI events,
// close it). The answer comes from the operator's machine, so the two sides only ever
// meet in the database.

// How long one stream stays open with nothing arriving before it ends and lets the
// browser reconnect. An answer may legitimately wait a long time for a runner to come
// online, so this is a bound on the connection, not on the answer.
const STREAM_MAX_MS = 30 * 60_000;
const KEEPALIVE_MS = 15_000;

// The agent this route acts on, or a 404. Only an external agent has a chat feed: an
// internal one is run in-process by /run and /run/stream.
async function requireExternalAgent(agentId: number, projectId: number) {
  const agent = await getAgentById(agentId, projectId);
  if (!agent) throw new HttpError(404, 'Agent not found');
  if (agent.kind !== 'external') {
    throw new HttpError(400, 'Only external agents are chatted with through the runner feed');
  }
  return agent;
}

export const agentChatRoutes = new Elysia({ name: 'agent-chat', detail: { tags: ['Agent Chat'] } })
  .use(authContext)
  .use(guards)
  .use(runnerAuth)

  .post(
    '/projects/:projectKey/ai-agents/:agentId/chat',
    async ({ params, project, body, user }) => {
      const caller = requireUser(user);
      const agent = await requireExternalAgent(params.agentId, project.id);
      if (!isTriggerableBy(agent, caller.id)) {
        throw new HttpError(403, 'This agent only takes tasks from its owner');
      }
      const sent = await sendMessage({
        agentId: params.agentId,
        userId: caller.id,
        prompt: body.prompt,
        threadId: body.threadId,
      });
      if (!sent) throw new HttpError(404, 'Thread not found');
      return sent;
    },
    {
      body: sendChatBody,
      params: agentParams,
      permission: ['ai_agents', 'read'],
      response: { 200: SendChatResponse, ...commonErrors },
      detail: {
        summary: 'Send a chat message',
        description:
          "Queue a message for an external agent's runner and return the answer it will " +
          'produce. Follow the answer with the stream endpoint.',
      },
    },
  )

  // The answer's events after `after`, as plain JSON. What the stream serves, for a
  // client that reconnects and for one that would rather poll.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/chat/:messageId/events',
    async ({ params, project, query, user }) => {
      const caller = requireUser(user);
      await requireExternalAgent(params.agentId, project.id);
      const page = await readEvents(params.messageId, params.agentId, caller.id, query.after);
      if (!page) throw new HttpError(404, 'Message not found');
      return page;
    },
    {
      params: chatMessageParams,
      query: chatEventsQuery,
      permission: ['ai_agents', 'read'],
      response: { 200: ChatEventsResponse, ...commonErrors },
      detail: { summary: 'Read answer events' },
    },
  )

  // The same events as Server-Sent Events, one `data:` line per JSON-encoded AG-UI
  // event, as the runner reports them. The connection is held open while the answer is
  // still being produced — including before a runner has taken it, which is what lets
  // the chat show that it is waiting.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/chat/:messageId/stream',
    async ({ params, project, query, user }) => {
      const caller = requireUser(user);
      await requireExternalAgent(params.agentId, project.id);
      // Checked before the stream starts, so an unknown answer is a 404 rather than a
      // stream that ends immediately.
      const after = query.after ?? 0;
      if (!(await readEvents(params.messageId, params.agentId, caller.id, after))) {
        throw new HttpError(404, 'Message not found');
      }
      return sseResponse(streamChatEvents(params.messageId, params.agentId, caller.id, after));
    },
    {
      params: chatMessageParams,
      query: chatEventsQuery,
      permission: ['ai_agents', 'read'],
      response: {
        // The success body is an SSE stream returned as a raw Response, so it is not a
        // JSON shape the validator can describe.
        200: t.Any(),
        ...commonErrors,
      },
      detail: { summary: 'Stream an answer' },
    },
  )

  // Stops the answer being produced. The runner learns of it on its next report and
  // kills the command; what the agent wrote before it stays in the transcript.
  .post(
    '/projects/:projectKey/ai-agents/:agentId/chat/:messageId/cancel',
    async ({ params, project, user }) => {
      const caller = requireUser(user);
      const agent = await requireExternalAgent(params.agentId, project.id);
      if (!isTriggerableBy(agent, caller.id)) {
        throw new HttpError(403, 'This agent only takes tasks from its owner');
      }
      const ok = await cancelMessage(params.messageId, params.agentId, caller.id);
      if (!ok) throw new HttpError(404, 'Message not found');
      return noContent();
    },
    {
      params: chatMessageParams,
      permission: ['ai_agents', 'read'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Stop an answer',
        description:
          'Stop the answer being produced for this message. Terminal: it is not claimed ' +
          'again and not retried.',
      },
    },
  )

  .post('/agent-chats/claim', async ({ agent }) => ({ message: await claimNextMessage(agent) }), {
    runnerAgent: true,
    response: { 200: ClaimChatResponse, ...errors(401, 403) },
    detail: {
      summary: 'Claim the next chat message',
      description:
        "Take the calling agent's next chat message to answer. The call waits for one " +
        'and returns message: null when none arrives. It is leased: report events, ' +
        'heartbeats, or a result, otherwise it is handed out again.',
    },
  })

  .post(
    '/agent-chats/:messageId/events',
    async ({ agent, params, body }) => {
      const ack = await appendEvents(agent.id, params.messageId, body.events);
      if (!ack) throw new HttpError(404, 'Message not found');
      if (body.sessionId) await setThreadSession(agent.id, params.messageId, body.sessionId);
      return ack;
    },
    {
      runnerAgent: true,
      params: runnerMessageParams,
      body: chatEventsBody,
      response: { 200: ChatAckResponse, ...commonErrors },
      detail: {
        summary: 'Report answer events',
        description:
          'Append AG-UI events to a claimed answer: text deltas, tool calls, run ' +
          'lifecycle. Reporting also extends the lease, and binds the thread to the ' +
          'session when `sessionId` is given. Answers `canceled` when the member stopped ' +
          'the answer: kill the command and stop reporting.',
      },
    },
  )

  .post(
    '/agent-chats/:messageId/heartbeat',
    async ({ agent, params }) => {
      const ack = await heartbeatMessage(agent.id, params.messageId);
      if (!ack) throw new HttpError(404, 'Message not found');
      return ack;
    },
    {
      runnerAgent: true,
      params: runnerMessageParams,
      response: { 200: ChatAckResponse, ...commonErrors },
      detail: {
        summary: 'Extend an answer lease',
        description:
          'Keep a claimed answer leased while the runner is still working on it. Answers ' +
          '`canceled` when the member stopped the answer, which is how a runner writing ' +
          'nothing learns of it.',
      },
    },
  )

  .post(
    '/agent-chats/:messageId/result',
    async ({ agent, params, body }) => {
      const ok = await finishMessage(agent.id, params.messageId, body);
      if (!ok) throw new HttpError(404, 'Message not found');
      return noContent();
    },
    {
      runnerAgent: true,
      params: runnerMessageParams,
      body: chatResultBody,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Finish an answer',
        description: 'Close a claimed answer as success or failed. A failure is not retried.',
      },
    },
  );

// The frames one stream sends: every event stored for the answer, in order, and then
// whatever arrives while it is still being produced. Each frame carries the event's id,
// which a client that reconnects passes back as `after` to resume where it stopped.
//
// The answer always ends on RUN_FINISHED or RUN_ERROR, synthesized when the runner
// reported neither, so a stream that closes without one means the connection dropped
// rather than the answer ending. Comment frames keep the connection alive through a
// proxy that would otherwise drop it while the agent is thinking.
async function* streamChatEvents(
  messageId: number,
  agentId: number,
  userId: string,
  after: number,
): AsyncGenerator<string> {
  const until = Date.now() + STREAM_MAX_MS;
  let cursor = after;
  let ended = false;
  let quietSince = Date.now();
  for (;;) {
    const page = await readEvents(messageId, agentId, userId, cursor);
    if (!page) return;
    for (const item of page.items) {
      if (item.event.type === 'RUN_ERROR' || item.event.type === 'RUN_FINISHED') ended = true;
      yield sseFrame(item.event, item.id);
    }
    if (page.nextCursor != null) {
      cursor = page.nextCursor;
      quietSince = Date.now();
    }
    // More is already stored than one read hands out: take it before deciding the
    // answer is over or waiting for the next tick.
    if (page.hasMore) continue;
    if (page.status !== 'pending' && page.status !== 'streaming') {
      if (!ended) yield sseFrame(terminalEvent(page.status, page.error), cursor);
      return;
    }
    if (Date.now() >= until) return;
    if (Date.now() - quietSince >= KEEPALIVE_MS) {
      yield ': ping\n\n';
      quietSince = Date.now();
    }
    await sleep(agentChatConfig.streamPollMs());
  }
}

// A stopped answer ends the stream the same way a finished one does: the stop was asked
// for, so it is not an error, and what the agent wrote before it is already in the frames
// the reader has.
function terminalEvent(status: ChatMessageStatus, error: string | null): AgUiEventBody {
  return status === 'failed'
    ? { type: 'RUN_ERROR', message: error ?? 'The agent did not finish the answer' }
    : { type: 'RUN_FINISHED' };
}
