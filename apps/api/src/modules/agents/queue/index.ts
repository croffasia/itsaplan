import { assertMcpAllowed, requiresPermission } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { externalTraceQuery, ExternalTraceResponse, runParams } from '../runner/model';
import { runProjectId, readRunTrace } from '../runner/run-events';
import { Elysia, type DocumentDecoration } from 'elysia';
import { authContext } from '#shared/auth-context';
import { assertPermission, requireUser } from '#shared/access';
import { commonErrors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import { isMcpRequest } from '#shared/mcp-request';
import { queueQuery, RunnerQueueResponse } from './model';
import { listRunnerQueue } from './service';

export const runnerQueueRoutes = new Elysia({
  name: 'runner-queue',
  detail: { tags: ['Agent Runner'] },
})
  .use(authContext)
  .macro({
    runTrace(_enabled: boolean) {
      return {
        detail: requiresPermission(['ai_agents', 'read']) as DocumentDecoration,
        async resolve({ params, user, request }) {
          const projectId = await runProjectId(Number((params as { runId: string }).runId));
          if (projectId == null) throw new HttpError(404, 'Run not found');
          await assertPermission(projectId, user, 'work_items', 'read');
          await assertPermission(projectId, user, 'ai_agents', 'read');
          await assertMcpAllowed(projectId, request.headers);
          return { projectId };
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
          'Recorded events and local Codex session of the selected or latest attempt. Requires both agent and work item read permission in the original project.',
      },
    },
  )
  .get(
    '/agent-runs/queue',
    async ({ user, query, request }) => {
      let counts = { queued: 0, running: 0 };
      const page = await paginate(query, async (window) => {
        const result = await listRunnerQueue(
          requireUser(user).id,
          window,
          isMcpRequest(request.headers),
          query.runId,
        );
        counts = { queued: result.queued, running: result.running };
        return result;
      });
      return { ...page, ...counts };
    },
    {
      query: queueQuery,
      response: { 200: RunnerQueueResponse, ...commonErrors },
      detail: {
        summary: 'Read the runner queue',
        description:
          'Active and past external runs across projects where the caller may read both ' +
          'work items and agents. Running leases first, waiting runs by due time, then newest past runs.',
      },
    },
  );
