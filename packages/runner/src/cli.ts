#!/usr/bin/env node
import { setTimeout as sleep } from 'node:timers/promises';
import { Client, RequestError, type Run } from './client';
import { loadConfig, type RunnerConfig } from './config';
import { execute } from './execute';

// The runner: claim a task, run the configured command, report the result, repeat.
// It holds no state — the queue is the server's — so stopping it mid-task only means
// that task's lease expires and another runner (or this one, restarted) picks it up.

const HEARTBEAT_MS = 60_000;

function log(message: string): void {
  console.log(`[itsaplan-runner] ${message}`);
}

// Keeps the lease alive while the command runs; a task can take much longer than the
// server's lease, and without this it would be handed out again mid-flight.
async function withHeartbeat<T>(client: Client, runId: number, work: Promise<T>): Promise<T> {
  const timer = setInterval(() => {
    client.heartbeat(runId).catch((err) => log(`heartbeat failed: ${String(err)}`));
  }, HEARTBEAT_MS);
  try {
    return await work;
  } finally {
    clearInterval(timer);
  }
}

async function handle(config: RunnerConfig, client: Client, run: Run): Promise<void> {
  const label = run.issueIdentifier ?? `run ${run.id}`;
  log(`${label}: started (${run.trigger})`);
  try {
    const outcome = await withHeartbeat(client, run.id, execute(config, run));
    await client.report(run.id, outcome);
    log(`${label}: ${outcome.status}${outcome.error ? ` — ${outcome.error}` : ''}`);
  } catch (err) {
    // The command itself never throws here; this is the runner failing to run or
    // report it. Reporting the failure keeps the run from being retried blindly.
    const message = err instanceof Error ? err.message : String(err);
    log(`${label}: runner error — ${message}`);
    await client.report(run.id, { status: 'failed', error: message }).catch(() => {});
  }
}

async function main(): Promise<void> {
  const configPath =
    process.argv[2] ?? process.env.ITSAPLAN_RUNNER_CONFIG ?? './itsaplan-runner.json';
  const config = await loadConfig(configPath);
  const client = new Client(config);
  const active = new Set<Promise<void>>();
  let stopping = false;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      // The commands run in their own process groups, so quitting now leaves them
      // running with nobody to report their result: the lease expires and the run is
      // handed out again.
      if (stopping) {
        log('quitting now — the commands in flight keep running, their runs are retried');
        process.exit(1);
      }
      stopping = true;
      log('stopping — finishing the tasks in flight, press again to quit now');
    });
  }

  log(
    `polling ${config.url} every ${config.pollIntervalMs}ms, up to ${config.concurrency} at once`,
  );
  while (!stopping) {
    if (active.size >= config.concurrency) {
      await Promise.race(active);
      continue;
    }
    let run: Run | null = null;
    try {
      run = await client.claim();
    } catch (err) {
      // A key the server refuses will be refused just as much on the next poll, so
      // stop instead of hiding it in a log line every few seconds.
      if (err instanceof RequestError && (err.status === 401 || err.status === 403)) throw err;
      log(`claim failed: ${String(err)}`);
    }
    if (!run) {
      await sleep(config.pollIntervalMs);
      continue;
    }
    const task = handle(config, client, run).finally(() => active.delete(task));
    active.add(task);
  }
  await Promise.all(active);
}

main().catch((err) => {
  console.error(`[itsaplan-runner] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
