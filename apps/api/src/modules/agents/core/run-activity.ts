import { recordActivity, textSide } from '#modules/issues/activity';
import { getIssue, updateIssue } from '#modules/issues/service';
import type { AgentRunTrigger } from '../model';
import { isProjectAgent } from './service';

// What happens on the issue when an agent takes a queued run of it. Only the first
// claim counts: a re-claim after an expired lease is the same task handed out again.
// A schedule's run on an issue first makes the agent the issue's delegate, so the issue
// shows which agent works on it.
export async function agentRunStarted(run: {
  issueId: number | null;
  attempts: number;
  agentUserId: string;
  trigger: AgentRunTrigger;
}): Promise<void> {
  if (run.issueId == null || run.attempts > 1) return;
  if (run.trigger === 'status' || run.trigger === 'event') {
    await delegateToAgent(run.issueId, run.agentUserId);
  }
  await recordActivity(run.issueId, [{ action: 'agent_started' }], run.agentUserId);
}

// The agent sets itself, so the delegation does not queue a second run. An agent that
// has left the project since its run was queued cannot be the delegate.
async function delegateToAgent(issueId: number, agentUserId: string): Promise<void> {
  const row = await getIssue(issueId);
  if (!row || row.delegateUserId === agentUserId) return;
  if (!(await isProjectAgent(row.projectId, agentUserId))) return;
  await updateIssue(issueId, { delegateUserId: agentUserId }, agentUserId);
}

// Records how the agent's run of the issue ended.
export async function recordAgentRunFinished(
  run: { issueId: number | null; agentUserId: string },
  status: 'success' | 'failed',
): Promise<void> {
  if (run.issueId == null) return;
  await recordActivity(
    run.issueId,
    [{ action: 'agent_finished', subject: textSide(status) }],
    run.agentUserId,
  );
}
