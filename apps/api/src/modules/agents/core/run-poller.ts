import { getProjectTeamId } from '#modules/projects/service';
import { intEnv } from '#shared/lib';
import { getLimits } from '#shared/limits';
import { equalJitterBackoffMs } from './helpers/backoff';
import { framePrompt, peopleContext, runModePreamble } from './prompt/framing';
import { recordAgentRunFinished, recordAgentRunStarted } from './run-activity';
import {
  agentRunConfig,
  claimDueRuns,
  countRunsAhead,
  deferRun,
  markRunFailed,
  markRunSuccess,
  scheduleRunRetry,
  type ClaimedRun,
} from './run-queue';
import { runAgent } from './runtime';
import { runThreadId } from './runtime/thread-ids';

// Drains the agent_run queue. The runtime, the model credentials and the limits are
// all here, so the run is claimed and executed in the same process — the queue row is
// the only thing a run is built from, so nothing about which project or which bot user
// it acts as can be handed in from outside.

// How long a run waits when its team has no free slot.
const DEFERRED_RETRY_SECONDS = 30;
const RETRY_BASE_MS = 30_000;
const RETRY_CAP_MS = 30 * 60_000;

export async function processAgentRuns(): Promise<void> {
  const runs = await claimDueRuns();
  await Promise.all(runs.map(processRun));
}

async function processRun(run: ClaimedRun): Promise<void> {
  const teamId = await getProjectTeamId(run.projectId);
  const { maxConcurrentRuns, maxRunSeconds } = await getLimits({ teamId });
  if (maxConcurrentRuns > 0 && (await countRunsAhead(teamId, run.id)) >= maxConcurrentRuns) {
    await deferRun(run.id, DEFERRED_RETRY_SECONDS);
    return;
  }
  // The issue's timeline entries are written here, where the agent's work actually
  // starts and ends. A failure that will be retried is not the end of the run, so only
  // the last attempt logs one.
  await recordAgentRunStarted(run);
  try {
    const result = await runAgent(run.agentId, run.projectId, framePrompt(run), {
      callerUserId: run.agentUserId,
      threadId: runThreadId(run),
      issueId: run.issueId,
      scheduleId: run.scheduleId,
      contextPreamble: runModePreamble(run.trigger) + peopleContext(run),
      abortSignal: AbortSignal.timeout(runTimeoutMs(maxRunSeconds)),
    });
    await recordAgentRunFinished(run, 'success');
    await markRunSuccess(run.id, result.text, result.usage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run.attempts < agentRunConfig.maxAttempts()) {
      await scheduleRunRetry(
        run.id,
        equalJitterBackoffMs(run.attempts, RETRY_BASE_MS, RETRY_CAP_MS),
        message,
      );
      return;
    }
    await recordAgentRunFinished(run, 'failed');
    await markRunFailed(run.id, message);
  }
}

// The wall time a run gets: the team's ceiling where it has one, and a cap of its own
// either way. Without it a run that never returns holds its slot until the claim lease
// expires and is then started again, having recorded nothing.
function runTimeoutMs(maxRunSeconds: number): number {
  const cap = intEnv('AGENT_RUN_TIMEOUT_MS', 240_000);
  return maxRunSeconds > 0 ? Math.min(maxRunSeconds * 1000, cap) : cap;
}
