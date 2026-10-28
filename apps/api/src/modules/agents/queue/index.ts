import { assertMcpAllowed, guards, requiresPermission } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { externalTraceQuery, ExternalTraceResponse, runParams } from '../runner/model';
import { visibleRun, readRunTrace } from '../runner/run-events';
import { getRunTrace } from '../core/runtime/traces';
import { issueAgentTraceQuery, IssueAgentRunTraceResponse } from '#modules/issues/model';
import { Elysia, type DocumentDecoration } from 'elysia';
import { authContext } from '#shared/auth-context';
import { hasPermission } from '@repo/db';
import { assertPermission, getTeamAccess, requireUser } from '#shared/access';
import { runsTeam } from '#modules/teams/service';
import { getProjectTeamId } from '#modules/projects/service';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import { isMcpRequest } from '#shared/mcp-request';
import { queueQuery, RunnerQueueResponse, RunsInFlightResponse } from './model';
import {
  listRunnerQueue,
  runsProjectTeam,
  scopeProjectIds,
  teamRunsInFlight,
  workspaceRunsInFlight,
} from './service';
import { teamParams } from '#modules/teams/model';
import { workspaceParams } from '#modules/workspaces/model';

// One page of the queue, with how many of its runs are waiting and running.
async function readQueue(
  userId: string,
  query: typeof queueQuery.static,
  mcpOnly: boolean,
  projectIds?: number[],
  granted = false,
) {
  let counts = { queued: 0, running: 0 };
  const page = await paginate(query, async (window) => {
    const result = await listRunnerQueue(userId, window, {
      mcpOnly,
      runId: query.runId,
      projectIds,
      granted,
    });
    counts = { queued: result.queued, running: result.running };
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
    runTrace(_enabled: boolean) {
      return {
        detail: requiresPermission(['ai_agents', 'read']) as DocumentDecoration,
        async resolve({ params, user, request }) {
          const run = await visibleRun(
            Number((params as { runId: string }).runId),
            requireUser(user).id,
          );
          if (!run) throw new HttpError(404, 'Run not found');
          const { projectId } = run;
          const teamId = await getProjectTeamId(projectId);
          if (!(await runsProjectTeam(teamId, requireUser(user).id))) {
            await assertPermission(projectId, user, 'work_items', 'read');
            await assertPermission(projectId, user, 'ai_agents', 'read');
            if (run.documentId != null) {
              await assertPermission(projectId, user, 'documents', 'read');
            }
          }
          await assertMcpAllowed(projectId, request.headers);
          return { projectId, agentId: run.agentId, issueId: run.issueId };
        },
      };
    },
  })
  .get(
    '/agent-runs/:runId/trace',
    async ({ params, query, projectId }) => {
      const trace = await readRunTrace(projectId, params.runId, query.attempt);
      if (trace === undefined) throw new HttpError(404, 'Run attempt not found');
      return Response.json(trace);
    },
    {
      runTrace: true,
      params: runParams,
      query: externalTraceQuery,
      response: { 200: ExternalTraceResponse, ...commonErrors },
      detail: {
        summary: 'Read an external run transcript',
        description:
          'Recorded events and local Codex session of the selected or latest attempt. Requires both agent and work item read permission in the original project, and document read permission for a run started in a document.',
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
        query.traceId,
      );
      if (trace === undefined) throw new HttpError(404, 'Run attempt not found');
      return Response.json(trace);
    },
    {
      runTrace: true,
      params: runParams,
      query: issueAgentTraceQuery,
      response: { 200: IssueAgentRunTraceResponse, ...commonErrors },
      detail: {
        summary: "Read an internal run's trace",
        description:
          "The selected or latest recorded attempt of an internal agent's run, on an issue or " +
          'on none, with a link to the previous one. Null when no latest trace is available. ' +
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
          'Active and past runs of internal and external agents across projects where the caller may read both ' +
          'work items and agents. A run started in a document also takes document read permission. ' +
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
