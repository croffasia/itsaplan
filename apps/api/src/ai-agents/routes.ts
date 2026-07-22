import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  regenerateKey,
  getAgentById,
} from './store';
import { runAgent, streamAgent, type RunOpts } from './runtime';
import { peoplePreamble } from './prompt/run-context';
import type { SessionUser } from '../shared/auth-context';
import { listAgentRuns } from './run-queue';
import { listChatThreads, getChatThreadMessages } from './runtime/memory';

const agentParams = t.Object({ projectKey: t.String(), agentId: t.Numeric() });

// Body of the interactive run endpoints. threadId continues a conversation when the
// agent has memory enabled; omit it to start a new thread (the id used is returned in
// the response).
const runBody = t.Object({
  prompt: t.String({ minLength: 1 }),
  threadId: t.Optional(t.String()),
});

// Run options for an interactive chat run (the test chat): the caller owns the memory
// thread and is named to the agent as the requester.
function chatRunOpts(user: SessionUser | null, threadId?: string): RunOpts {
  const caller = requireUser(user);
  return {
    callerUserId: caller.id,
    threadId: threadId ?? null,
    contextPreamble: peoplePreamble({
      requester: { name: user?.name ?? caller.email ?? 'User', userId: caller.id },
    }),
  };
}

// A username is a short handle used to address the agent; keep it URL/mention safe.
const username = t.String({
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-zA-Z0-9._-]+$',
  description: 'Mention handle (letters, digits, . _ -).',
});

// Internal-agent model configuration, all optional so a config can be filled in
// over time. Ignored (stored as null/empty) for an external agent.
const configFields = {
  modelCredentialId: t.Optional(
    t.Nullable(t.Number({ description: 'Integration credential id for the LLM provider.' })),
  ),
  model: t.Optional(t.Nullable(t.String({ description: 'Model id, e.g. claude-sonnet-5.' }))),
  instructions: t.Optional(t.Nullable(t.String({ description: 'System prompt for the agent.' }))),
  tools: t.Optional(
    t.Array(t.String(), { description: 'Granted tool keys from list_ai_agent_tools.' }),
  ),
  temperature: t.Optional(t.Nullable(t.Number({ description: 'Sampling temperature.' }))),
  maxSteps: t.Optional(t.Nullable(t.Integer({ description: 'Max tool-call steps per run.' }))),
  memoryEnabled: t.Optional(
    t.Boolean({ description: 'Keep conversation memory across a thread.' }),
  ),
  memoryLastMessages: t.Optional(
    t.Nullable(t.Integer({ minimum: 1, description: 'How many recent messages to recall.' })),
  ),
  triggerOnMention: t.Optional(t.Boolean({ description: 'Run when @-mentioned in a comment.' })),
  triggerOnAssign: t.Optional(t.Boolean({ description: 'Run when assigned to an issue.' })),
  roleId: t.Optional(
    t.Nullable(
      t.Integer({ description: 'project_role the bot acts under; null uses the default role.' }),
    ),
  ),
};

// An agent DTO (AiAgentRow from the store).
const AiAgentResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  userId: t.String(),
  name: t.String(),
  username: t.String(),
  kind: t.Union([t.Literal('external'), t.Literal('internal')]),
  modelCredentialId: t.Nullable(t.Number()),
  model: t.Nullable(t.String()),
  instructions: t.Nullable(t.String()),
  tools: t.Array(t.String()),
  temperature: t.Nullable(t.Number()),
  maxSteps: t.Nullable(t.Number()),
  memoryEnabled: t.Boolean(),
  memoryLastMessages: t.Nullable(t.Number()),
  triggerOnMention: t.Boolean(),
  triggerOnAssign: t.Boolean(),
  roleId: t.Nullable(t.Number()),
  createdAt: t.String(),
  apiKeyStart: t.Nullable(t.String()),
  modelProvider: t.Nullable(t.String()),
  actionCount: t.Number(),
  skillCount: t.Number(),
  toolCount: t.Number(),
});

// createAgent's result: the agent plus its one-time API key secret (null for an
// internal agent, which has no key).
const CreateAgentResponse = t.Object({
  agent: AiAgentResponse,
  apiKey: t.Nullable(t.String()),
});

// The new API key secret returned once by regenerate-key.
const RegenerateKeyResponse = t.Object({ apiKey: t.String() });

// A run's generated text and the conversation thread id (null when memory is off).
const RunAgentResponse = t.Object({
  text: t.String(),
  threadId: t.Nullable(t.String()),
});

// One row of an agent's run history (AgentRunRow from run-queue).
const AgentRunResponse = t.Object({
  id: t.Number(),
  status: t.String(),
  trigger: t.Union([
    t.Literal('mention'),
    t.Literal('delegation'),
    t.Literal('schedule'),
    t.Literal('manual'),
  ]),
  issueId: t.Nullable(t.Number()),
  issueIdentifier: t.Nullable(t.String()),
  issueTitle: t.Nullable(t.String()),
  prompt: t.String(),
  attempts: t.Number(),
  lastError: t.Nullable(t.String()),
  nextAttemptAt: t.String(),
  createdAt: t.String(),
});

// One page of an agent's runs (AgentRunPage from run-queue).
const AgentRunPageResponse = t.Object({
  items: t.Array(AgentRunResponse),
  nextCursor: t.Nullable(t.Number()),
});

// One chat thread in the caller's history with an agent (ChatThreadSummary).
const ChatThreadResponse = t.Object({
  id: t.String(),
  title: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// One page of a chat thread's transcript (ChatMessagePage).
const ChatMessagesResponse = t.Object({
  items: t.Array(
    t.Object({
      id: t.String(),
      role: t.Union([t.Literal('user'), t.Literal('assistant')]),
      text: t.String(),
      createdAt: t.String(),
    }),
  ),
  nextPage: t.Nullable(t.Number()),
});

export const aiAgentRoutes = new Elysia({ name: 'ai-agents', detail: { tags: ['AI Agents'] } })
  .use(authContext)
  .use(guards)
  .get('/projects/:projectKey/ai-agents', ({ project }) => listAgents(project.id), {
    permission: ['ai_agents', 'read'],
    response: {
      200: t.Array(AiAgentResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
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
      response: {
        200: AiAgentResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      body: t.Object({
        name: t.String({ minLength: 1, description: 'Display name.' }),
        username,
        kind: t.Union([t.Literal('external'), t.Literal('internal')], {
          description: "'external' (API key) or 'internal' (in-process, needs a model config).",
        }),
        ...configFields,
      }),
      permission: ['ai_agents', 'create'],
      response: {
        201: CreateAgentResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
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
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        username: t.Optional(username),
        ...configFields,
      }),
      params: agentParams,
      permission: ['ai_agents', 'edit'],
      response: {
        200: AiAgentResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
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
      response: {
        200: RegenerateKeyResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      query: t.Object({
        before: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      permission: ['ai_agents', 'read'],
      response: {
        200: AgentRunPageResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete an AI agent',
        description: 'Delete an AI agent and its bot user. Irreversible.',
        ...mcpTool('delete_ai_agent'),
      },
    },
  )

  // Runs an internal agent against a prompt and returns its generated text. The
  // agent is built from its stored model configuration (Mastra). External agents
  // have no config and return 400.
  .post(
    '/projects/:projectKey/ai-agents/:agentId/run',
    async ({ params, project, body, user }) =>
      runAgent(params.agentId, project.id, body.prompt, chatRunOpts(user, body.threadId)),
    {
      body: runBody,
      params: agentParams,
      permission: ['ai_agents', 'read'],
      response: {
        200: RunAgentResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Run an AI agent',
        description: 'Run an internal AI agent with a prompt and return its text.',
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
        chatRunOpts(user, body.threadId),
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
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
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
      response: {
        200: t.Array(ChatThreadResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      params: t.Object({ projectKey: t.String(), agentId: t.Numeric(), threadId: t.String() }),
      query: t.Object({ page: t.Optional(t.Numeric({ minimum: 0 })) }),
      permission: ['ai_agents', 'read'],
      response: {
        200: ChatMessagesResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Get thread messages' },
    },
  );
