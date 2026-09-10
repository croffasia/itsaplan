import { Elysia, t } from 'elysia';
import { runAgent } from './runtime';
import { deleteThreadsWhere } from './runtime/memory';
import { runThreadId } from './runtime/thread-ids';
import { framePrompt, runModePreamble, peopleContext } from './prompt/framing';
import { recordAgentRunFinished, recordAgentRunStarted } from './run-activity';
import { agentRunConfig, countRunsAhead } from './run-queue';
import { getProjectTeamId } from '#modules/projects/service';
import { getLimits } from '#shared/limits';

const runBody = t.Object({
  id: t.Number(),
  agentId: t.Number(),
  issueId: t.Nullable(t.Number()),
  scheduleId: t.Nullable(t.Number()),
  trigger: t.UnionEnum(['mention', 'delegation', 'field', 'schedule', 'manual']),
  prompt: t.String(),
  attempts: t.Number(),
  projectId: t.Number(),
  agentUserId: t.String(),
  issueIdentifier: t.Nullable(t.String()),
  issueTitle: t.Nullable(t.String()),
  assigneeName: t.Nullable(t.String()),
  requesterName: t.Nullable(t.String()),
  // Optional so a worker still running the previous build can hand a run over.
  agentUsername: t.Optional(t.Nullable(t.String())),
  assigneeUsername: t.Optional(t.Nullable(t.String())),
  requesterUsername: t.Optional(t.Nullable(t.String())),
  sourceActivityId: t.Optional(t.Nullable(t.Number())),
  threadContext: t.Optional(t.Nullable(t.String())),
});

function workerTokenValid(headers: Record<string, string | undefined>): boolean {
  const expected = process.env.WORKER_INTERNAL_TOKEN;
  return !!expected && headers['x-worker-token'] === expected;
}

export const internalAgentRunRoutes = new Elysia({
  name: 'internal-agent-runs',
  detail: { tags: ['Internal'] },
})
  .post(
    '/internal/agent-runs/execute',
    async ({ body, headers, set }) => {
      if (!workerTokenValid(headers)) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      const teamId = await getProjectTeamId(body.projectId);
      const { maxConcurrentRuns, maxRunSeconds } = await getLimits({ teamId });
      // Turned back before anything is recorded, so a run that waits for a free slot
      // leaves no trace on the issue and keeps the attempts it has.
      if (maxConcurrentRuns > 0 && (await countRunsAhead(teamId, body.id)) >= maxConcurrentRuns) {
        set.status = 503;
        return { error: 'The team is already running as many agents as it may at once' };
      }
      // The worker writes the run's own status; the issue's timeline entries are
      // written here, where the agent's work actually starts and ends. A failure the
      // worker will retry is not the end of the run, so only the last attempt logs one.
      await recordAgentRunStarted(body);
      try {
        const result = await runAgent(body.agentId, body.projectId, framePrompt(body), {
          callerUserId: body.agentUserId,
          threadId: runThreadId(body),
          issueId: body.issueId,
          scheduleId: body.scheduleId,
          contextPreamble: runModePreamble(body.trigger) + peopleContext(body),
          ...(maxRunSeconds > 0 ? { abortSignal: AbortSignal.timeout(maxRunSeconds * 1000) } : {}),
        });
        await recordAgentRunFinished(body, 'success');
        // The worker owns the run row, so the counts go back with the answer for it to
        // store. Null where the model reports none, which the run history shows as a dash.
        return { output: result.text, usage: result.usage };
      } catch (error) {
        if (body.attempts >= agentRunConfig.maxAttempts())
          await recordAgentRunFinished(body, 'failed');
        throw error;
      }
    },
    {
      body: runBody,
      detail: {
        summary: 'Execute a queued agent run',
        description:
          'Run one claimed agent run in the api, where the model credentials and the agent ' +
          'runtime live, and return the text the agent produced. Called by the worker with ' +
          'the x-worker-token header.',
      },
    },
  )

  // Deletes the agent memory of archived issues. The worker's auto-archive sweep
  // writes archived_at directly in the database and does not import Mastra, so it
  // asks the api to drop the threads the same way it asks it to run an agent.
  .post(
    '/internal/agent-threads/delete-for-issues',
    async ({ body, headers, set }) => {
      if (!workerTokenValid(headers)) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      let deleted = 0;
      for (const issueId of body.issueIds) deleted += await deleteThreadsWhere({ issueId });
      return { deleted };
    },
    {
      body: t.Object({ issueIds: t.Array(t.Number()) }),
      detail: {
        summary: 'Delete the agent threads of issues',
        description:
          'Drop the agent memory threads of the given issues and return how many were ' +
          'deleted. Called by the worker with the x-worker-token header.',
      },
    },
  );
