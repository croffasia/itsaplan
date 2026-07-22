import { Elysia, t } from 'elysia';
import { runAgent } from './runtime';
import { framePrompt, runModePreamble, peopleContext } from './prompt/framing';

const runBody = t.Object({
  id: t.Number(),
  agentId: t.Number(),
  issueId: t.Nullable(t.Number()),
  scheduleId: t.Nullable(t.Number()),
  trigger: t.UnionEnum(['mention', 'delegation', 'schedule', 'manual']),
  prompt: t.String(),
  projectId: t.Number(),
  agentUserId: t.String(),
  issueIdentifier: t.Nullable(t.String()),
  issueTitle: t.Nullable(t.String()),
  assigneeUserId: t.Nullable(t.String()),
  assigneeName: t.Nullable(t.String()),
  requesterUserId: t.Nullable(t.String()),
  requesterName: t.Nullable(t.String()),
});

export const internalAgentRunRoutes = new Elysia({ name: 'internal-agent-runs' }).post(
  '/internal/agent-runs/execute',
  async ({ body, headers, set }) => {
    const expected = process.env.WORKER_INTERNAL_TOKEN;
    if (!expected || headers['x-worker-token'] !== expected) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    const result = await runAgent(body.agentId, body.projectId, framePrompt(body), {
      callerUserId: body.agentUserId,
      threadId: body.issueId != null ? `issue:${body.issueId}` : `run:${body.id}`,
      contextPreamble: runModePreamble(body.trigger) + peopleContext(body),
    });
    return { output: result.text };
  },
  { body: runBody },
);
