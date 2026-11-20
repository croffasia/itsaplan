import { assertMcpAllowed, guards, requiresPermission } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { externalTraceQuery, ExternalTraceResponse, runParams } from '../runner/model';
import { visibleRun, readRunTrace } from '../runner/run-events';
import { getRunTrace } from '../core/runtime/traces';
import { IssueAgentRunTraceResponse } from '#modules/issues/model';
import { Elysia, type DocumentDecoration } from 'elysia';
import { authContext } from '#shared/auth-context';
import { hasPermission } from '@repo/db';
import { getTeamAccess, requireUser } from '#shared/access';
import { runsTeam } from '#modules/teams/service';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import { isMcpRequest } from '#shared/mcp-request';
import { mcpTool } from '#mcp/generate';
import { getAgentRunResult } from '../core/run-queue';
import {
  AgentRunResultResponse,
  internalTraceQuery,
  queueQuery,
  RunnerQueueResponse,
  RunsInFlightResponse,
  RunInitiatorOptionsResponse,
  RunProjectOptionsResponse,
} from './model';
import {
  assertReadsRuns,
  assertReadsRunSteps,
  listRunInitiators,
  listRunnerQueue,
  listRunProjects,
  runsProjectTeam,
  scopeProjectIds,
  teamRunsInFlight,
  workspaceRunsInFlight,
} from './service';
import { teamParams } from '#modules/teams/model';
import { workspaceParams } from '#modules/workspaces/model';

// One page of the queue, with how many of its runs are waiting, running and failed.
async function readQueue(
  userId: string,
  query: typeof queueQuery.static,
  mcpOnly: boolean,
  projectIds?: number[],
  granted = false,
) {
  let counts = { queued: 0, running: 0, failed: 0 };
  const page = await paginate(query, async (window) => {
    const result = await listRunnerQueue(userId, window, {
      mcpOnly,
      runId: query.runId,
      projectIds,
      granted,
      state: query.state,
      q: query.q,
      initiatorIds: query.initiatorIds?.split(','),
      onlyProjectIds: query.projectIds?.split(',').map(Number),
    });
    counts = { queued: result.queued, running: result.running, failed: result.failed };
    return result;
  });
  return { ...page, ...counts };
}

export const runnerQueueRoutes = new Elysia({
  name: 'runner-queue',
  detail: { tags: ['Agent Runner'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    // Whoever runs the team, or manages its workspace with agents to read. Everyone else
    // reads the runs of a project in that project.
    teamRuns(_enabled: boolean) {
      return {
        async resolve({ params, user }) {
          const teamId = Number((params as { teamId: string }).teamId);
          const access = await getTeamAccess(teamId, requireUser(user).id);
          if (!access) throw new HttpError(404, 'Team not found');
          const managesWorkspace = access.grant && hasPermission(access.grant, 'ai_agents', 'read');
          if (!runsTeam(access.role) && !managesWorkspace) {
            throw new HttpError(403, 'Only whoever runs the team or its workspace reads its runs');
          }
        },
      };
    },
    readRun(part: 'answer' | 'steps') {
      return {
        detail: requiresPermission(['ai_agents', 'read']) as DocumentDecoration,
        async resolve({ params, user, request }) {
          const viewer = requireUser(user);
          const run = await visibleRun(Number((params as { runId: string }).runId), viewer.id);
          if (!run) throw new HttpError(404, 'Run not found');
          const { projectId } = run;
          await assertReadsRuns(projectId, viewer);
          if (part === 'steps') await assertReadsRunSteps(run, viewer.id);
          await assertMcpAllowed(projectId, request.headers);
          return { projectId, agentId: run.agentId, issueId: run.issueId };
        },
      };
    },
  })
  .get(
    '/agent-runs/:runId',
    async ({ params }) => {
      const run = await getAgentRunResult(params.runId);
      if (!run) throw new HttpError(404, 'Run not found');
      return run;
    },
    {
      readRun: 'answer',
      params: runParams,
      response: { 200: AgentRunResultResponse, ...commonErrors },
      detail: {
        summary: 'Read an agent run',
        description:
          "Get a run's status and, when it ended, the agent's answer or error. While the run " +
          'waits or runs, retryAfterSeconds says when to read it again. Needs agent read ' +
          "permission in the run's project.",
        ...mcpTool('get_agent_run'),
      },
    },
  )
  .get(
    '/agent-runs/:runId/trace',
    async ({ params, query, projectId }) => {
      const trace = await readRunTrace(projectId, params.runId, query.attempt);
      if (trace === undefined) throw new HttpError(404, 'Run attempt not found');
      return Response.json(trace);
    },
    {
      readRun: 'steps',
      params: runParams,
      query: externalTraceQuery,
      response: { 200: ExternalTraceResponse, ...commonErrors },
      detail: {
        summary: 'Read an external run transcript',
        description:
          "Recorded events and local Codex session of the selected or latest attempt. Requires agent read permission in the run's project, and creating or changing its agents unless the caller runs the team, owns the project or is the run's initiator.",
      },
    },
  )
  .get(
    '/agent-runs/:runId/internal-trace',
    async ({ params, query, projectId, agentId, issueId, user }) => {
      const trace = await getRunTrace(
        agentId,
        params.runId,
        projectId,
        issueId,
        requireUser(user).id,
        query,
      );
      if (trace === undefined) throw new HttpError(404, 'Run attempt not found');
      return Response.json(trace);
    },
    {
      readRun: 'steps',
      params: runParams,
      query: internalTraceQuery,
      response: { 200: IssueAgentRunTraceResponse, ...commonErrors },
      detail: {
        summary: "Read an internal run's trace",
        description:
          "One recorded attempt of an internal agent's run, on an issue or on none: picked by " +
          'its trace id or its number, or else the latest. It carries its number, how many ' +
          'attempts were recorded, and a link to the previous one. Null when no latest trace ' +
          'is available. ' +
          'Takes the same permissions as the external transcript.',
      },
    },
  )
  .get(
    '/agent-runs/queue',
    ({ user, query, request }) =>
      readQueue(requireUser(user).id, query, isMcpRequest(request.headers)),
    {
      query: queueQuery,
      response: { 200: RunnerQueueResponse, ...commonErrors },
      detail: {
        summary: 'Read the runner queue',
        description:
          'Active and past runs of internal and external agents across projects where the caller may read agents, ' +
          'with where each run comes from. A run started in a private document shows only to whoever may read it. ' +
          'Running leases first, waiting runs by due time, then newest past runs.',
      },
    },
  )
  .get(
    '/projects/:projectKey/agent-runs/queue',
    async ({ user, query, request, project }) => {
      const userId = requireUser(user).id;
      const granted = await runsProjectTeam(project.teamId, userId);
      return readQueue(userId, query, isMcpRequest(request.headers), [project.id], granted);
    },
    {
      memberAdmin: ['ai_agents', 'read'],
      query: queueQuery,
      response: { 200: RunnerQueueResponse, ...commonErrors },
      detail: {
        summary: "Read a project's run queue",
        description:
          'The runner queue narrowed to one project, with the same permissions and order.',
      },
    },
  )
  .get(
    '/projects/:projectKey/agent-runs/initiators/options',
    async ({ user, request, project }) => {
      const userId = requireUser(user).id;
      return listRunInitiators(userId, {
        mcpOnly: isMcpRequest(request.headers),
        projectIds: [project.id],
        granted: await runsProjectTeam(project.teamId, userId),
      });
    },
    {
      memberAdmin: ['ai_agents', 'read'],
      response: { 200: RunInitiatorOptionsResponse, ...commonErrors },
      detail: {
        summary: "List the initiators of a project's runs",
        description: "Everyone a run of the project's queue works for, for its filter.",
      },
    },
  )
  .get(
    '/projects/:projectKey/agent-runs/in-flight',
    ({ project }) => teamRunsInFlight(project.teamId),
    {
      memberAdmin: ['ai_agents', 'read'],
      response: { 200: RunsInFlightResponse, ...accessErrors },
      detail: {
        summary: 'Read how many internal agent runs are in flight',
        description:
          "How many runs of internal agents are in flight in the project's workspace, and the " +
          "workspace's limit on them.",
      },
    },
  )
  .get(
    '/teams/:teamId/agent-runs/queue',
    async ({ user, query, request, membership }) =>
      readQueue(
        requireUser(user).id,
        query,
        isMcpRequest(request.headers),
        await scopeProjectIds({ teamId: membership.teamId }),
        true,
      ),
    {
      params: teamParams,
      query: queueQuery,
      teamPermission: ['ai_agents', 'read'],
      teamRuns: true,
      response: { 200: RunnerQueueResponse, ...commonErrors },
      detail: {
        summary: "Read a team's run queue",
        description:
          "The runner queue narrowed to the team's projects, for whoever runs the team or its " +
          'workspace. Everyone else reads it per project.',
      },
    },
  )
  .get(
    '/teams/:teamId/agent-runs/initiators/options',
    async ({ user, request, membership }) =>
      listRunInitiators(requireUser(user).id, {
        mcpOnly: isMcpRequest(request.headers),
        projectIds: await scopeProjectIds({ teamId: membership.teamId }),
        granted: true,
      }),
    {
      params: teamParams,
      teamPermission: ['ai_agents', 'read'],
      teamRuns: true,
      response: { 200: RunInitiatorOptionsResponse, ...commonErrors },
      detail: {
        summary: "List the initiators of a team's runs",
        description: "Everyone a run of the team's queue works for, for its filter.",
      },
    },
  )
  .get(
    '/teams/:teamId/agent-runs/projects/options',
    async ({ user, request, membership }) =>
      listRunProjects(requireUser(user).id, {
        mcpOnly: isMcpRequest(request.headers),
        projectIds: await scopeProjectIds({ teamId: membership.teamId }),
        granted: true,
      }),
    {
      params: teamParams,
      teamPermission: ['ai_agents', 'read'],
      teamRuns: true,
      response: { 200: RunProjectOptionsResponse, ...commonErrors },
      detail: {
        summary: "List the projects of a team's run queue",
        description: "The projects of the team's queue, for its filter.",
      },
    },
  )
  .get(
    '/teams/:teamId/agent-runs/in-flight',
    ({ membership }) => teamRunsInFlight(membership.teamId),
    {
      params: teamParams,
      teamPermission: ['ai_agents', 'read'],
      teamRuns: true,
      response: { 200: RunsInFlightResponse, ...commonErrors },
      detail: {
        summary: 'Read how many internal agent runs are in flight',
        description:
          "How many runs of internal agents are in flight in the team's workspace, and the " +
          "workspace's limit on them.",
      },
    },
  )
  .get(
    '/workspaces/:workspaceId/agent-runs/queue',
    async ({ user, query, request, standing }) =>
      readQueue(
        requireUser(user).id,
        query,
        isMcpRequest(request.headers),
        await scopeProjectIds({ workspaceId: standing.workspaceId }),
        true,
      ),
    {
      workspaceManager: true,
      params: workspaceParams,
      query: queueQuery,
      response: { 200: RunnerQueueResponse, ...errors(400, 401, 404) },
      detail: {
        summary: "Read a workspace's run queue",
        description:
          'The runner queue narrowed to the projects of every team of a workspace you manage.',
      },
    },
  )
  .get(
    '/workspaces/:workspaceId/agent-runs/initiators/options',
    async ({ user, request, standing }) =>
      listRunInitiators(requireUser(user).id, {
        mcpOnly: isMcpRequest(request.headers),
        projectIds: await scopeProjectIds({ workspaceId: standing.workspaceId }),
        granted: true,
      }),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 200: RunInitiatorOptionsResponse, ...errors(401, 404) },
      detail: {
        summary: "List the initiators of a workspace's runs",
        description: "Everyone a run of the workspace's queue works for, for its filter.",
      },
    },
  )
  .get(
    '/workspaces/:workspaceId/agent-runs/projects/options',
    async ({ user, request, standing }) =>
      listRunProjects(requireUser(user).id, {
        mcpOnly: isMcpRequest(request.headers),
        projectIds: await scopeProjectIds({ workspaceId: standing.workspaceId }),
        granted: true,
      }),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 200: RunProjectOptionsResponse, ...errors(401, 404) },
      detail: {
        summary: "List the projects of a workspace's run queue",
        description: "The projects of the workspace's queue, for its filter.",
      },
    },
  )
  .get(
    '/workspaces/:workspaceId/agent-runs/in-flight',
    ({ standing }) => workspaceRunsInFlight(standing.workspaceId),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 200: RunsInFlightResponse, ...errors(401, 404) },
      detail: {
        summary: 'Read how many internal agent runs are in flight',
        description:
          'How many runs of internal agents are in flight in a workspace you manage, and the ' +
          "workspace's limit on them.",
      },
    },
  );
