import { Elysia, t } from 'elysia';
import { noContent, sseFrame, sseResponse } from '#shared/http';
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
  type AgentKind,
} from './service';
import {
  AgentRunPageResponse,
  AiAgentListResponse,
  AiAgentResponse,
  ChatMessagesResponse,
  ChatThreadListResponse,
  CreateAgentResponse,
  renameThreadBody,
  RegenerateKeyResponse,
  RunAgentResponse,
  agentParams,
  createAgentBody,
  runBody,
  runsQuery,
  threadListQuery,
  threadPageQuery,
  threadParams,
  updateAgentBody,
} from './model';
import { runAgent, streamAgent, type AgentRunEvent, type RunOpts } from './runtime';
import { peoplePreamble } from './prompt/run-context';
import { attachmentPreamble, chartPreamble } from './prompt/framing';
import type { SessionUser } from '#shared/auth-context';
import { listAgentRuns } from './run-queue';
import {
  listChatThreads,
  getChatThreadMessages,
  deleteChatThread,
  renameChatThread,
  ownsChatThread,
} from './runtime/memory';
import { addFavorite, removeFavorite } from '../chat-favorites';
import { isOwnChatThread } from './runtime/thread-ids';
import {
  listThreads as listExternalThreads,
  getThreadMessages as getExternalThreadMessages,
  deleteThread as deleteExternalThread,
  renameThread as renameExternalThread,
  ownsThread as ownsExternalThread,
} from '../chat/service';

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
    contextPreamble:
      chartPreamble() +
      attachmentPreamble() +
      peoplePreamble({
        requester: {
          name: user?.name ?? caller.email ?? 'User',
          username: user?.username ?? null,
        },
      }),
  };
}

async function* runFrames(events: AsyncIterable<AgentRunEvent>): AsyncGenerator<string> {
  for await (const event of events) yield sseFrame(event);
}

// Where a thread of this agent is kept: an external agent's conversations are held by
// the chat feed its runner drains, an internal agent's by the runtime memory. The routes
// below serve both through the same shapes.
function threadStore(kind: AgentKind) {
  return kind === 'external'
    ? {
        list: listExternalThreads,
        messages: getExternalThreadMessages,
        rename: renameExternalThread,
        remove: deleteExternalThread,
        owns: ownsExternalThread,
      }
    : {
        list: listChatThreads,
        messages: getChatThreadMessages,
        rename: renameChatThread,
        remove: deleteChatThread,
        owns: ownsChatThread,
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
    async ({ project, body, set, user }) => {
      set.status = 201;
      return createAgent(project.id, { ...body, ownerUserId: requireUser(user).id });
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
    async ({ params, project, body, user }) => {
      const agent = await updateAgent(params.agentId, project.id, body, requireUser(user).id);
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
  //
  // The run is bound to this connection: the caller dropping it — by pressing stop in
  // the chat, or by closing the page — aborts the run instead of leaving it going with
  // nobody reading it.
  .post(
    '/projects/:projectKey/ai-agents/:agentId/run/stream',
    ({ params, project, body, user, request }) =>
      sseResponse(
        runFrames(
          streamAgent(
            params.agentId,
            project.id,
            body.prompt,
            chatRunOpts(user, params.agentId, body.threadId),
            request.signal,
          ),
        ),
      ),
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

  // The caller's own chat threads with this agent, newest first, a page at a time.
  // Scoped to the caller (the thread's owner), so a user only sees their own
  // conversations. `q` searches them and `favorites` returns the starred ones instead.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/threads',
    async ({ params, project, query, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      return threadStore(agent.kind).list(caller.id, params.agentId, query);
    },
    {
      params: agentParams,
      query: threadListQuery,
      permission: ['ai_agents', 'read'],
      response: { 200: ChatThreadListResponse, ...commonErrors },
      detail: { summary: 'List chat threads' },
    },
  )

  // Stars one of the caller's conversations, so it stays in the favorites group of the
  // history. Scoped the same way as reading it: a thread that is not the caller's own
  // with this agent is a 404.
  .put(
    '/projects/:projectKey/ai-agents/:agentId/threads/:threadId/favorite',
    async ({ params, project, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      if (!(await threadStore(agent.kind).owns(params.threadId, caller.id, params.agentId)))
        throw new HttpError(404, 'Thread not found');
      await addFavorite(caller.id, params.agentId, params.threadId);
      return noContent();
    },
    {
      params: threadParams,
      permission: ['ai_agents', 'read'],
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Star a chat thread' },
    },
  )

  .delete(
    '/projects/:projectKey/ai-agents/:agentId/threads/:threadId/favorite',
    async ({ params, project, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      if (!(await threadStore(agent.kind).owns(params.threadId, caller.id, params.agentId)))
        throw new HttpError(404, 'Thread not found');
      await removeFavorite(caller.id, params.threadId);
      return noContent();
    },
    {
      params: threadParams,
      permission: ['ai_agents', 'read'],
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Unstar a chat thread' },
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
      const messages = await threadStore(agent.kind).messages(
        params.threadId,
        caller.id,
        query.page,
      );
      if (messages === null) throw new HttpError(404, 'Thread not found');
      return messages;
    },
    {
      params: threadParams,
      query: threadPageQuery,
      permission: ['ai_agents', 'read'],
      response: { 200: ChatMessagesResponse, ...commonErrors },
      detail: { summary: 'Get thread messages' },
    },
  )

  // Renames one of the caller's chat threads. Scoped the same way as reading it: a
  // thread owned by another user is a 404.
  .patch(
    '/projects/:projectKey/ai-agents/:agentId/threads/:threadId',
    async ({ params, project, body, user }) => {
      const caller = requireUser(user);
      const agent = await getAgentById(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      const renamed = await threadStore(agent.kind).rename(params.threadId, caller.id, body.title);
      if (!renamed) throw new HttpError(404, 'Thread not found');
      return noContent();
    },
    {
      params: threadParams,
      body: renameThreadBody,
      permission: ['ai_agents', 'read'],
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Rename a chat thread' },
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
      const deleted = await threadStore(agent.kind).remove(params.threadId, caller.id);
      if (!deleted) throw new HttpError(404, 'Thread not found');
      return noContent();
    },
    {
      params: threadParams,
      permission: ['ai_agents', 'read'],
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Delete a chat thread' },
    },
  );
