import { answer } from './chat';
import type { ChatMessage, Client, Run } from './client';
import type { RunnerConfig } from './config';
import { runTask } from './run';

// One task of either feed, from the moment the runner holds it to its reported result. A
// task is the same whether the runner claimed it or the instance sent it.

const HEARTBEAT_MS = 60_000;

export type Log = (message: string) => void;

// A task can take much longer than the server's lease; without this it would be handed
// out again mid-flight.
async function withHeartbeat<T>(log: Log, beat: () => Promise<void>, work: Promise<T>): Promise<T> {
  const timer = setInterval(() => {
    beat().catch((err) => log(`heartbeat failed: ${String(err)}`));
  }, HEARTBEAT_MS);
  try {
    return await work;
  } finally {
    clearInterval(timer);
  }
}

export async function handleRun(
  config: RunnerConfig,
  client: Client,
  log: Log,
  run: Run,
): Promise<void> {
  const label = run.issueIdentifier ?? `run ${run.id}`;
  log(`${label}: started (${run.trigger})`);
  try {
    const outcome = await withHeartbeat(
      log,
      () => client.heartbeat(run.id, run.traceEvents ? run.attempts : undefined),
      runTask(config, client, run),
    );
    log(`${label}: ${outcome.status}${outcome.error ? ` — ${outcome.error}` : ''}`);
  } catch (err) {
    // The command itself never throws here; this is the runner failing to run or
    // report it. Reporting the failure keeps the run from being retried blindly.
    const message = err instanceof Error ? err.message : String(err);
    log(`${label}: runner error — ${message}`);
    await client
      .report(run.id, {
        status: 'failed',
        error: message,
        ...(run.traceEvents && { attempt: run.attempts }),
      })
      .catch(() => {});
  }
}

// The stop the member pressed comes back on whichever call the runner was making: the
// events report while the command writes, the heartbeat while it is silent. Both abort
// the same controller, which kills the command.
export async function handleChat(
  config: RunnerConfig,
  client: Client,
  log: Log,
  message: ChatMessage,
): Promise<void> {
  log(`chat ${message.id}: answering`);
  const stop = new AbortController();
  try {
    await withHeartbeat(
      log,
      async () => {
        if (await client.chatHeartbeat(message.id)) stop.abort();
      },
      answer(config, client, message, stop),
    );
  } catch (err) {
    // Without a reported failure the chat waits for an answer that is no longer coming.
    // A stopped answer is already closed, so nothing is reported for it.
    if (!stop.signal.aborted) {
      const text = err instanceof Error ? err.message : String(err);
      log(`chat ${message.id}: runner error — ${text}`);
      await client.chatResult(message.id, { status: 'failed', error: text }).catch(() => {});
      return;
    }
  }
  log(`chat ${message.id}: ${stop.signal.aborted ? 'stopped' : 'answered'}`);
}
