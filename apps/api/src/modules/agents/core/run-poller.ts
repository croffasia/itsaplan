import { db, teamWorkspaceId } from '@repo/db';
import { getProjectTeamId } from '#modules/projects/service';
import { getAgentSettings } from '#modules/settings/service';
import { getLimits, getRunLimit } from '#shared/limits';
import { framePrompt, peopleContext, runModePreamble } from './prompt/framing';
import { agentRunStarted, recordAgentRunFinished } from './run-activity';
import { runAdmissionDelay } from './run-admission';
import { runRefusal } from './run-refusal';
import {
  agentRunConfig,
  claimDueRuns,
  admitWorkspaceRun,
  countRunsAhead,
  deferRun,
  markRunFailed,
  markRunSuccess,
  runRetryDelayMs,
  scheduleRunRetry,
  type ClaimedRun,
} from './run-queue';
import { STEP_LIMIT_MESSAGE, runAgent } from './runtime';
import { runThreadId } from './runtime/thread-ids';

// Drains the agent_run queue. The runtime, the model credentials and the limits are
// all here, so the run is claimed and executed in the same process — the queue row is
// the only thing a run is built from, so nothing about which project or which bot user
// it acts as can be handed in from outside.

export async function processAgentRuns(): Promise<void> {
  const runs = await claimDueRuns();
  await Promise.all(runs.map(processRun));
}

async function processRun(run: ClaimedRun): Promise<void> {
  const teamId = await getProjectTeamId(run.projectId);
  const workspaceId = await teamWorkspaceId(teamId, db);
  const limits = await getLimits(workspaceId);
  const runLimit = await getRunLimit(workspaceId, limits);
  if (runLimit > 0 && (await countRunsAhead(workspaceId, run.id)) >= runLimit) {
    await deferRun(run.id, 30);
    return;
  }
  const wait = await runAdmissionDelay(run);
  if (wait > 0) {
    await deferRun(run.id, wait);
    return;
  }
  // Refused before anything is recorded on the issue, and not retried: the attempt would
  // be refused for the same reason.
  const refused = await runRefusal({
    agentId: run.agentId,
    teamId,
    projectId: run.projectId,
    userId: run.requesterUserId,
  });
  if (refused) {
    await markRunFailed(run.id, refused);
    return;
  }
  // The issue's timeline entries are written here, where the agent's work actually
  // starts and ends. A failure that will be retried is not the end of the run, so only
  // the last attempt logs one.
  const configuredTimeoutMs = runTimeoutMs(
    run.agentRunTimeoutSec,
    (await getAgentSettings()).maxRunSeconds,
    limits.maxRunSeconds,
  );
  if (run.executionDeadline <= performance.now()) return;
  try {
    if (!(await admitWorkspaceRun(run, workspaceId, runLimit))) return;
    await agentRunStarted(run);
    const timeoutMs = Math.floor(
      Math.min(configuredTimeoutMs, run.executionDeadline - performance.now()),
    );
    if (timeoutMs <= 0) {
      await recordAgentRunFinished(run, 'failed');
      await markRunFailed(run.id, 'Claim execution budget exhausted');
      return;
    }
    const result = await runAgent(run.agentId, run.projectId, framePrompt(run), {
      callerUserId: run.agentUserId,
      threadId: runThreadId(run),
      issueId: run.issueId,
      scheduleId: run.scheduleId,
      runId: run.id,
      trigger: run.trigger,
      contextPreamble: runModePreamble(run) + peopleContext(run),
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    if (result.aborted) {
      // Mastra resolves generate() on abort, so the partial text would read as a success.
      // Not retried: a run that hits the time limit will hit it again.
      await recordAgentRunFinished(run, 'failed');
      await markRunFailed(run.id, `Timed out after ${Math.round(timeoutMs / 1000)}s`, result.text);
      return;
    }
    if (result.stepLimit) {
      await recordAgentRunFinished(run, 'failed');
      await markRunFailed(run.id, STEP_LIMIT_MESSAGE);
      return;
    }
    await recordAgentRunFinished(run, 'success');
    await markRunSuccess(run.id, result.text, result.usage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run.attempts < agentRunConfig.maxAttempts()) {
      await scheduleRunRetry(run.id, runRetryDelayMs(run.attempts), message);
      return;
    }
    await recordAgentRunFinished(run, 'failed');
    await markRunFailed(run.id, message);
  }
}

// The wall time a run gets: the agent's own limit or else the instance's maximum, never
// above that maximum or the workspace's ceiling where it has one. Without a limit a run
// that never returns holds its slot until the claim lease expires and is then started
// again, having recorded nothing.
function runTimeoutMs(
  agentSeconds: number | null,
  instanceSeconds: number,
  workspaceSeconds: number,
): number {
  const seconds = Math.min(agentSeconds ?? instanceSeconds, instanceSeconds);
  return (workspaceSeconds > 0 ? Math.min(seconds, workspaceSeconds) : seconds) * 1000;
}
