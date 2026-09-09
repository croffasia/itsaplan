import { Elysia, t } from 'elysia';
import { noContent, sseFrame, sseResponse } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser, type TeamMembership } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { teamParams } from '#modules/teams/model';
import { runsTeam } from '#modules/teams/service';
import { paginate } from '#shared/pagination';
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  regenerateKey,
  getAgentById,
  getAgentInProject,
  agentScopeOf,
  memberProjectIds,
  type AgentKind,
} from './service';
import {
  AgentAnalyticsResponse,
  AgentRunPageResponse,
  AgentTraceDetailResponse,
  AgentTracePageResponse,
  AiAgentListResponse,
  AiAgentResponse,
  ChatMessagesResponse,
  ChatThreadListResponse,
  CreateAgentResponse,
  renameThreadBody,
  RegenerateKeyResponse,
  RunAgentResponse,
  agentListQuery,
  agentParams,
  createAgentBody,
  projectAgentParams,
  runBody,
  runsQuery,
  setAgentProjectsBody,
  threadListQuery,
  threadPageQuery,
  analyticsQuery,
  threadParams,
  traceParams,
  tracesQuery,
  updateAgentBody,
} from './model';
import { runAgent, streamAgent, type AgentRunEvent, type RunOpts } from './runtime';
import { peoplePreamble } from './prompt/run-context';
import { attachmentPreamble, chartPreamble } from './prompt/framing';
import type { SessionUser } from '#shared/auth-context';
import { listAgentRuns } from './run-queue';
import { getAgentTrace, listAgentTraces } from './runtime/traces';
import { getAgentAnalytics } from './runtime/analytics';
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

// The window the dashboard reads when the caller names none.
const DEFAULT_ANALYTICS_DAYS = 30;

// Whether the caller may read the traces of that project: an owner or a manager of the
// team reads every project the agent works in, anyone else only a project they belong to
// themselves. The list names the project in the query and one trace carries it in its own
// metadata, so a trace that names none is refused to everyone else.
async function assertTraceScope(
  membership: TeamMembership,
  projectId: number | null,
): Promise<void> {
  if (runsTeam(membership.role)) return;
  const mine =
    projectId == null ? [] : await memberProjectIds(membership.teamId, membership.userId);
  if (!mine.includes(projectId as number)) {
    throw new HttpError(403, 'You can only read the traces of a project you are a member of');
  }
}

// The agent a :agentId path addresses, scoped by agentScopeOf — one of another team, and
// one of a project the caller is not in, both read as missing.
async function requireVisibleAgent(agentId: number, membership: TeamMembership) {
  const agent = await getAgentById(agentId, membership.teamId, agentScopeOf(membership));
  if (!agent) throw new HttpError(404, 'Agent not found');
  return agent;
}

// The projects the caller may put the agent in: an owner or a manager of the team
// reaches every project it owns, anyone else only the projects they are a member of
// themselves. A project outside that set is refused. One the agent already works in
// and the caller cannot see is kept, so a partial view never detaches it.
async function resolveAgentProjects(
  membership: TeamMembership,
  next: number[] | undefined,
  current: { id: number }[],
): Promise<number[] | undefined> {
  if (next == null || runsTeam(membership.role)) return next;
  const mine = new Set(await memberProjectIds(membership.teamId, membership.userId));
  if (next.some((id) => !mine.has(id))) {
    throw new HttpError(403, 'You can only attach an agent to a project you are a member of');
  }
  const hidden = current.filter((p) => !mine.has(p.id)).map((p) => p.id);
  return [...next, ...hidden];
}

// An agent belongs to a team, so managing it — creating, editing, attaching it to a
// project, reading its key — sits under :teamId, gated by the ai_agents resource on the
// team: its owner and managers always, an owner of one of its projects always, another
// member when a project role of theirs grants it. One path carries one guard; a second
// one under the project would need its own answer for a project member who holds no
// rights in the team.
//
// The permission is merged from every project role the caller holds in the team, so it
// says what they may do, not which agents they may do it to. Which ones is
// requireVisibleAgent above: everyone but an owner or a manager of the team reaches
// only the agents working in a project they belong to, and resolveAgentProjects bounds
// where they may put one the same way.
//
// Running an agent and chatting with it stay under :projectKey. Both act inside one
// project, which is what the permission check and the agent's tools are bound to.
export const aiAgentRoutes = new Elysia({ name: 'ai-agents', detail: { tags: ['AI Agents'] } })
  .use(authContext)
  .use(guards)
  .get(
    '/teams/:teamId/ai-agents',
    ({ membership, query }) =>
      listAgents(membership.teamId, query.projectId, agentScopeOf(membership)),
    {
      params: teamParams,
      query: agentListQuery,
      teamPermission: ['ai_agents', 'read'],
      response: { 200: AiAgentListResponse, ...accessErrors },
      detail: {
        summary: 'List AI agents',
        description:
          "List the team's AI agents with their config. Pass projectId to list only the agents " +
          'working in that project.',
        ...mcpTool('list_ai_agents'),
      },
    },
  )

  .get(
    '/teams/:teamId/ai-agents/:agentId',
    ({ params, membership }) => requireVisibleAgent(params.agentId, membership),
    {
      params: agentParams,
      teamPermission: ['ai_agents', 'read'],
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
    '/teams/:teamId/ai-agents',
    async ({ membership, body, set, user }) => {
      const projectIds = await resolveAgentProjects(membership, body.projectIds, []);
      set.status = 201;
      return createAgent(membership.teamId, {
        ...body,
        projectIds,
        ownerUserId: requireUser(user).id,
      });
    },
    {
      params: teamParams,
      body: createAgentBody,
      teamPermission: ['ai_agents', 'create'],
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
    '/teams/:teamId/ai-agents/:agentId',
    async ({ params, membership, body, user }) => {
      const current = await requireVisibleAgent(params.agentId, membership);
      const projectIds = await resolveAgentProjects(membership, body.projectIds, current.projects);
      const agent = await updateAgent(
        params.agentId,
        membership.teamId,
        { ...body, projectIds },
        requireUser(user).id,
      );
      if (!agent) throw new HttpError(404, 'Agent not found');
      return agent;
    },
    {
      body: updateAgentBody,
      params: agentParams,
      teamPermission: ['ai_agents', 'edit'],
      response: { 200: AiAgentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update an AI agent',
        description: "Update an AI agent's name, username, projects, or model config.",
        ...mcpTool('update_ai_agent'),
      },
    },
  )

  // The projects of the team the agent works in. Membership is what lets its key reach
  // a project, so this is both the attach and the detach: the set is replaced.
  .put(
    '/teams/:teamId/ai-agents/:agentId/projects',
    async ({ params, membership, body, user }) => {
      const current = await requireVisibleAgent(params.agentId, membership);
      const projectIds = await resolveAgentProjects(membership, body.projectIds, current.projects);
      const agent = await updateAgent(
        params.agentId,
        membership.teamId,
        { projectIds },
        requireUser(user).id,
      );
      if (!agent) throw new HttpError(404, 'Agent not found');
      return agent;
    },
    {
      body: setAgentProjectsBody,
      params: agentParams,
      teamPermission: ['ai_agents', 'edit'],
      response: { 200: AiAgentResponse, ...commonErrors },
      detail: {
        summary: "Set an AI agent's projects",
        description:
          'Replace the projects of the team the agent works in. Send the full set: a project ' +
          'left out is detached. A project of another team is rejected, and so is one the ' +
          'caller is not a member of unless they run the team.',
        ...mcpTool('set_ai_agent_projects'),
      },
    },
  )

  // Rotates the agent's API key (delete + create) and returns the new secret once.
  // Only external agents have a key; regenerating on an internal agent is a 400.
  .post(
    '/teams/:teamId/ai-agents/:agentId/regenerate-key',
    async ({ params, membership }) => {
      const agent = await requireVisibleAgent(params.agentId, membership);
      if (agent.kind !== 'external')
        throw new HttpError(400, 'Internal agents do not use an API key');
      const apiKey = await regenerateKey(params.agentId, membership.teamId);
      if (apiKey == null) throw new HttpError(404, 'Agent not found');
      return { apiKey };
    },
    {
      params: agentParams,
      teamPermission: ['ai_agents', 'edit'],
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
  // it, newest first, paginated. Test-chat runs are not recorded here. A run carries
  // the prompt it was given and what it answered, so it is bounded to the projects the
  // reader is a member of — seeing the agent is not seeing what it did everywhere.
  .get(
    '/teams/:teamId/ai-agents/:agentId/runs',
    async ({ params, membership, query }) => {
      await requireVisibleAgent(params.agentId, membership);
      const projectIds = runsTeam(membership.role)
        ? undefined
        : await memberProjectIds(membership.teamId, membership.userId);
      return listAgentRuns(params.agentId, {
        before: query.before,
        limit: query.limit,
        projectIds,
      });
    },
    {
      params: agentParams,
      query: runsQuery,
      teamPermission: ['ai_agents', 'read'],
      response: { 200: AgentRunPageResponse, ...commonErrors },
      detail: {
        summary: 'List agent runs',
        description:
          "List an agent's triggered runs. An owner or a manager of the team sees them all; " +
          'anyone else only the runs that happened in a project they belong to.',
      },
    },
  )

  // The traces of the agent's runs: what the model and the tools were called with at
  // every step, recorded by the runtime. A run of the queue carries its runId, so the
  // run history and its trace name each other.
  .get(
    '/teams/:teamId/ai-agents/:agentId/traces',
    async ({ params, membership, query }) => {
      await requireVisibleAgent(params.agentId, membership);
      await assertTraceScope(membership, query.projectId ?? null);
      return paginate(query, (window) =>
        listAgentTraces(params.agentId, {
          ...window,
          ...(query.projectId != null ? { projectId: query.projectId } : {}),
        }),
      );
    },
    {
      params: agentParams,
      query: tracesQuery,
      teamPermission: ['ai_agents', 'read'],
      response: { 200: AgentTracePageResponse, ...commonErrors },
      detail: {
        summary: 'List agent traces',
        description:
          "One page of the traces of an agent's runs, newest first. An owner or a manager of " +
          'the team reads them all; anyone else names a project they belong to.',
      },
    },
  )

  .get(
    '/teams/:teamId/ai-agents/:agentId/traces/:traceId',
    async ({ params, membership }) => {
      await requireVisibleAgent(params.agentId, membership);
      const trace = await getAgentTrace(params.agentId, params.traceId);
      if (!trace) throw new HttpError(404, 'Trace not found');
      await assertTraceScope(membership, trace.trace.projectId);
      return trace;
    },
    {
      params: traceParams,
      teamPermission: ['ai_agents', 'read'],
      response: { 200: AgentTraceDetailResponse, ...commonErrors },
      detail: {
        summary: 'Read an agent trace',
        description:
          'Every step of one trace, oldest first: the run, the model calls it made, and the ' +
          'tools it used, each with what it was given and what it returned.',
      },
    },
  )

  // What the team's agents did over a window: how many runs, what the models read and
  // wrote and cost, which tools were called, and how long a run took. Read from the
  // same traces as the run detail above.
  .get(
    '/teams/:teamId/agent-analytics',
    ({ membership, query }) =>
      getAgentAnalytics({
        teamId: membership.teamId,
        days: query.days ?? DEFAULT_ANALYTICS_DAYS,
      }),
    {
      params: teamParams,
      query: analyticsQuery,
      teamManager: true,
      response: { 200: AgentAnalyticsResponse, ...accessErrors },
      detail: {
        summary: 'Read the agent dashboard of a team',
        description:
          'Run, token, cost, tool and latency figures for every agent of the team, over the ' +
          'last `days` days beside the same span before it. Read by an owner or a manager of ' +
          'the team.',
      },
    },
  )

  .get(
    '/projects/:projectKey/agent-analytics',
    ({ project, query }) =>
      getAgentAnalytics({
        teamId: project.teamId,
        projectId: project.id,
        days: query.days ?? DEFAULT_ANALYTICS_DAYS,
      }),
    {
      query: analyticsQuery,
      permission: ['agent_analytics', 'read'],
      response: { 200: AgentAnalyticsResponse, ...accessErrors },
      detail: {
        summary: 'Read the agent dashboard of a project',
        description:
          'The same figures as the team dashboard, for the runs that worked in this project.',
      },
    },
  )

  .delete(
    '/teams/:teamId/ai-agents/:agentId',
    async ({ params, membership }) => {
      await requireVisibleAgent(params.agentId, membership);
      const ok = await deleteAgent(params.agentId, membership.teamId);
      if (!ok) throw new HttpError(404, 'Agent not found');
      return noContent();
    },
    {
      params: agentParams,
      teamPermission: ['ai_agents', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an AI agent',
        description: 'Delete an AI agent and its bot user. Irreversible.',
        ...mcpTool('delete_ai_agent'),
      },
    },
  )

  // The agent is built from its stored model configuration (Mastra) and works in the
  // project of this path, which it has to be a member of.
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
      params: projectAgentParams,
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
      params: projectAgentParams,
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
      const agent = await getAgentInProject(params.agentId, project.id);
      if (!agent) throw new HttpError(404, 'Agent not found');
      return threadStore(agent.kind).list(caller.id, params.agentId, query);
    },
    {
      params: projectAgentParams,
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
      const agent = await getAgentInProject(params.agentId, project.id);
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
      const agent = await getAgentInProject(params.agentId, project.id);
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
      const agent = await getAgentInProject(params.agentId, project.id);
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
      const agent = await getAgentInProject(params.agentId, project.id);
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
      const agent = await getAgentInProject(params.agentId, project.id);
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
