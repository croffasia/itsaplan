import { recordActivity, textSide } from '#modules/issues/activity';

// Records that an agent took a queued run of the issue. Only the first claim is
// logged: a re-claim after an expired lease is the same task handed out again.
export async function recordAgentRunStarted(run: {
  issueId: number | null;
  attempts: number;
  agentUserId: string;
}): Promise<void> {
  if (run.issueId == null || run.attempts > 1) return;
  await recordActivity(run.issueId, [{ action: 'agent_started' }], run.agentUserId);
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
