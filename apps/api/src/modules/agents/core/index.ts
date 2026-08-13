import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  regenerateKey,
  getAgentById,
} from './service';
import {
  AgentRunPageResponse,
  AiAgentListResponse,
  AiAgentResponse,
  ChatMessagesResponse,
  ChatThreadListResponse,
  CreateAgentResponse,
  RegenerateKeyResponse,
  RunAgentResponse,
  agentParams,
  createAgentBody,
  runBody,
  runsQuery,
  threadMessagesQuery,
  threadParams,
  updateAgentBody,
} from './model';
import { runAgent, streamAgent, type RunOpts } from './runtime';
import { peoplePreamble } from './prompt/run-context';
import type { SessionUser } from '#shared/auth-context';
import { listAgentRuns } from './run-queue';
import { listChatThreads, getChatThreadMessages, deleteChatThread } from './runtime/memory';
import { isOwnChatThread } from './runtime/thread-ids';

// Run options for an interactive chat run (the test chat): the caller owns the memory
// thread and is named to the agent as the requester. A supplied thread id must be one
// issued to this caller for this agent — anyone else's chat, and the threads of the
// autonomous runs, read as not found.
function chatRunOpts(user: SessionUser | null, agentId: number, threadId?: string): RunOpts {
  const caller = requireUser(user);
  if (threadId != null && !isOwnChatThread(threadId, agentId, caller.id)) {
    throw new HttpError(404, 'Thread not found');
  }
  return {
    callerUserId: caller.id,
    threadId: threadId ?? null,
    contextPreamble: peoplePreamble({
      requester: { name: user?.name ?? caller.email ?? 'User', userId: caller.id },
    }),
  };
}

export const aiAgentRoutes = new Elysia({ name: 'ai-agents', detail: { tags: ['AI Agents'] } })
  .use(authContext)
  .use(guards)
  .get('/projects/:projectKey/ai-agents', ({ project }) => listAgents(project.id), {
    permission: ['ai_agents', 'read'],
    response: { 200: AiAgentListResponse, ...accessErrors },
    detail: {
      summary: 'List AI agents',
      description: "List a project's AI agents with their config.",
      ...mcpTool('list_ai_agents'),
    },
  })

  .get(
    '/projects/:projectKey/ai-agents/:agentId',
    async ({ params, project }) => {
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      return agent;
    },
    {
      params: agentParams,
      permission: ['ai_agents', 'read'],
      response: { 200: AiAgentResponse, ...commonErrors },
      detail: {
        summary: 'Get an AI agent',
        description: 'Get an AI agent by id with its config.',
        ...mcpTool('get_ai_agent'),
      },
    },
  )

  // Creates an agent. An external agent also gets its first API key, returned once
  // here and never available again (regenerate to get a new one); an internal agent
  // runs in-process and has no key, so apiKey comes back null.
  .post(
    '/projects/:projectKey/ai-agents',
    async ({ project, body, set }) => {
      set.status = 201;
      return createAgent(project.id, body);
    },
    {
      body: createAgentBody,
      permission: ['ai_agents', 'create'],
      response: { 201: CreateAgentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Create an AI agent',
        description:
          "Create an AI agent. kind 'external' returns an API key once; kind 'internal' runs " +
          'in-process from a model config and has no key.',
        ...mcpTool('create_ai_agent'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/ai-agents/:agentId',
    async ({ params, project, body }) => {
      const agent = await updateAgent(params.agentId, project.id, body);
      if (!agent) throw new HttpError(404, 'Agent not found');
      return agent;
    },
    {
      body: updateAgentBody,
      params: agentParams,
      permission: ['ai_agents', 'edit'],
      response: { 200: AiAgentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update an AI agent',
        description: "Update an AI agent's name, username, or model config.",
        ...mcpTool('update_ai_agent'),
      },
    },
  )

  // Rotates the agent's API key (delete + create) and returns the new secret once.
  // Only external agents have a key; regenerating on an internal agent is a 400.
  .post(
    '/projects/:projectKey/ai-agents/:agentId/regenerate-key',
    async ({ params, project }) => {
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      if (agent.kind !== 'external')
        throw new HttpError(400, 'Internal agents do not use an API key');
      const apiKey = await regenerateKey(params.agentId, project.id);
      if (apiKey == null) throw new HttpError(404, 'Agent not found');
      return { apiKey };
    },
    {
      params: agentParams,
      permission: ['ai_agents', 'edit'],
      response: { 200: RegenerateKeyResponse, ...commonErrors },
      detail: {
        summary: 'Regenerate the API key',
        description: "Rotate an external agent's API key and return the new secret once.",
        // Rotating invalidates the previous key, which cannot be recovered.
        ...mcpTool('regenerate_ai_agent_key', { destructiveHint: true }),
      },
    },
  )

  // The agent's run history: the triggered runs (a mention or a delegation) queued for
  // it, newest first, paginated. Test-chat runs are not recorded here.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/runs',
    async ({ params, project, query }) => {
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      return listAgentRuns(params.agentId, { before: query.before, limit: query.limit });
    },
    {
      params: agentParams,
      query: runsQuery,
      permission: ['ai_agents', 'read'],
      response: { 200: AgentRunPageResponse, ...commonErrors },
      detail: {
        summary: 'List agent runs',
        description: "List an agent's triggered runs.",
      },
    },
  )

  .delete(
    '/projects/:projectKey/ai-agents/:agentId',
    async ({ params, project }) => {
      const ok = await deleteAgent(params.agentId, project.id);
      if (!ok) throw new HttpError(404, 'Agent not found');
      return noContent();
    },
    {
      params: agentParams,
      permission: ['ai_agents', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an AI agent',
        description: 'Delete an AI agent and its bot user. Irreversible.',
        ...mcpTool('delete_ai_agent'),
      },
    },
  )

  // The agent is built from its stored model configuration (Mastra).
  .post(
    '/projects/:projectKey/ai-agents/:agentId/run',
    async ({ params, project, body, user }) =>
      runAgent(
        params.agentId,
        project.id,
        body.prompt,
        chatRunOpts(user, params.agentId, body.threadId),
      ),
    {
      body: runBody,
      params: agentParams,
      permission: ['ai_agents', 'read'],
      response: { 200: RunAgentResponse, ...commonErrors },
      detail: {
        summary: 'Run an AI agent',
        description:
          'Send a prompt to an internal AI agent and return its answer. Only an internal agent ' +
          'runs here; an external one has no model config and returns 400.',
        ...mcpTool('run_ai_agent'),
      },
    },
  )

  // Same as /run but streams the response as Server-Sent Events: one `data:` line
  // per JSON-encoded AgentRunEvent (text chunks, the tools the agent uses, then a
  // final `done` with the thread id). Lets the UI show the answer and what the
  // agent is doing as it happens. Errors mid-stream arrive as an `error` event.
  .post(
    '/projects/:projectKey/ai-agents/:agentId/run/stream',
    ({ params, project, body, user }) => {
      const events = streamAgent(
        params.agentId,
        project.id,
        body.prompt,
        chatRunOpts(user, params.agentId, body.threadId),
      );
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for await (const event of events) {
            // The consumer cancelled (e.g. closed the chat): stop consuming the
            // agent stream instead of enqueuing onto a closed controller.
            if (controller.desiredSize === null) return;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    },
    {
      body: runBody,
      params: agentParams,
      permission: ['ai_agents', 'read'],
      response: {
        // The success body is an SSE stream (text/event-stream), returned as a raw
        // Response, so it is not a JSON shape the validator can describe.
        200: t.Any(),
        ...commonErrors,
      },
      detail: {
        summary: 'Run an AI agent (stream)',
        description: "Stream an internal AI agent's response as it is generated.",
      },
    },
  )

  // The caller's own chat threads with this agent, newest first. Scoped to the
  // caller (the thread's owner), so a user only sees their own conversations.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/threads',
    async ({ params, project, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      return listChatThreads(caller.id, params.agentId);
    },
    {
      params: agentParams,
      permission: ['ai_agents', 'read'],
      response: { 200: ChatThreadListResponse, ...commonErrors },
      detail: { summary: 'List chat threads' },
    },
  )

  // The transcript of one of the caller's chat threads, to restore the conversation
  // in the UI. 404 when the thread does not exist or is not owned by the caller.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/threads/:threadId/messages',
    async ({ params, project, query, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      const messages = await getChatThreadMessages(params.threadId, caller.id, query.page ?? 0);
      if (messages === null) throw new HttpError(404, 'Thread not found');
      return messages;
    },
    {
      params: threadParams,
      query: threadMessagesQuery,
      permission: ['ai_agents', 'read'],
      response: { 200: ChatMessagesResponse, ...commonErrors },
      detail: { summary: 'Get thread messages' },
    },
  )

  // Deletes one of the caller's chat threads with its messages. Scoped the same way as
  // reading it: a thread owned by another user is a 404.
  .delete(
    '/projects/:projectKey/ai-agents/:agentId/threads/:threadId',
    async ({ params, project, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      if (!(await deleteChatThread(params.threadId, caller.id))) {
        throw new HttpError(404, 'Thread not found');
      }
      return noContent();
    },
    {
      params: threadParams,
      permission: ['ai_agents', 'read'],
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Delete a chat thread' },
    },
  );
