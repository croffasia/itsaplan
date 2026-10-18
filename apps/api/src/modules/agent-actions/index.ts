import { Elysia, t } from 'elysia';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { projectsWithPermission, requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import { agentParams } from '#modules/agents/model';
import { getAgentById } from '#modules/agents/core/service';
import { getIssueProjectId } from '#modules/issues/service';
import {
  AgentActionPageResponse,
  PendingActionPageResponse,
  PendingActionResponse,
  agentActionsQuery,
  issueIdParams,
  pendingActionParams,
  pendingActionsQuery,
  rejectBody,
} from './model';
import {
  approvePendingAction,
  getPendingActionProjectId,
  listAgentActions,
  listIssuePendingActions,
  listPendingActions,
  rejectPendingAction,
} from './service';

async function requireTeamAgent(agentId: number, teamId: number) {
  const agent = await getAgentById(agentId, teamId);
  if (!agent) throw new HttpError(404, 'Agent not found');
  return agent;
}

// What an agent did and what waits for approval. The agent-wide lists follow the agent
// dashboard: agent_usage read, each member seeing the projects their role grants it in.
// A held call is decided on its project by whoever may edit its work items.
export const agentActionRoutes = new Elysia({
  name: 'agent-actions',
  detail: { tags: ['AI Agents'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    workItem: entityGuard('work_items', 'Issue not found', (p) =>
      getIssueProjectId(Number(p.issueId)),
    ),
    pendingAction: entityGuard('work_items', 'Action not found', (p) =>
      getPendingActionProjectId(Number(p.actionId)),
    ),
  })
  .get(
    '/teams/:teamId/ai-agents/:agentId/actions',
    async ({ params, membership, query }) => {
      const agent = await requireTeamAgent(params.agentId, membership.teamId);
      const projectIds = await projectsWithPermission(membership, 'agent_usage', 'read');
      const scope =
        query.projectId == null
          ? projectIds
          : (projectIds ?? [query.projectId]).filter((id) => id === query.projectId);
      const range = {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      };
      return paginate(query, (window) => listAgentActions(agent.id, scope, range, window));
    },
    {
      params: agentParams,
      query: agentActionsQuery,
      teamPermission: ['agent_usage', 'read'],
      response: { 200: AgentActionPageResponse, ...commonErrors },
      detail: {
        summary: 'List what an agent did',
        description:
          'The write calls an agent made, newest first: the tool, its arguments, whether it ' +
          'succeeded and the error when not, the run that made it, and who approved it ' +
          'when it was held. `from` and `to` narrow it to a time range.',
      },
    },
  )
  .get(
    '/teams/:teamId/ai-agents/:agentId/pending-actions',
    async ({ params, membership, query }) => {
      await requireTeamAgent(params.agentId, membership.teamId);
      const projectIds = await projectsWithPermission(membership, 'agent_usage', 'read');
      return paginate(query, (window) =>
        listPendingActions(params.agentId, projectIds, query.status, window),
      );
    },
    {
      params: agentParams,
      query: pendingActionsQuery,
      teamPermission: ['agent_usage', 'read'],
      response: { 200: PendingActionPageResponse, ...commonErrors },
      detail: {
        summary: 'List the held calls of an agent',
        description:
          'The tool calls of an agent that requires approval, newest first; `status` ' +
          'narrows them to pending, approved, rejected, failed or expired. A call not ' +
          'decided within 7 days expires.',
      },
    },
  )
  .get('/issues/:issueId/agent-actions', ({ params }) => listIssuePendingActions(params.issueId), {
    params: issueIdParams,
    workItem: 'read',
    response: { 200: t.Array(PendingActionResponse), ...accessErrors },
    detail: {
      summary: 'List the held agent calls on an issue',
      description: 'The calls agents made on this issue that wait for approval, oldest first.',
    },
  })
  .post(
    '/agent-actions/:actionId/approve',
    ({ params, user }) => approvePendingAction(params.actionId, requireUser(user).id),
    {
      params: pendingActionParams,
      pendingAction: 'edit',
      response: { 200: PendingActionResponse, ...accessErrors, ...errors(409) },
      detail: {
        summary: 'Approve a held agent call',
        description:
          "Applies the call as the agent, with the agent's own role. A call the route " +
          'refuses is kept as `failed` with its answer in `result`.',
      },
    },
  )
  .post(
    '/agent-actions/:actionId/reject',
    ({ params, body, user }) =>
      rejectPendingAction(params.actionId, body.reason, requireUser(user).id),
    {
      params: pendingActionParams,
      body: rejectBody,
      pendingAction: 'edit',
      response: { 200: PendingActionResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Reject a held agent call',
        description: 'Discards the call and keeps the reason.',
      },
    },
  );
