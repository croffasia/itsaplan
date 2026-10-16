import { Elysia } from 'elysia';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
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
  .get(
    '/agent-runs/queue',
    async ({ user, query, request }) => {
      let counts = { queued: 0, running: 0 };
      const page = await paginate(query, async (window) => {
        const result = await listRunnerQueue(
          requireUser(user).id,
          window,
          isMcpRequest(request.headers),
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
          'Waiting and executing external runs across projects where the caller may read both ' +
          'work items and agents. Running leases first, then waiting runs by due time and id.',
      },
    },
  );
