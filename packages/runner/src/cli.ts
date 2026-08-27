#!/usr/bin/env node
import { setTimeout as sleep } from 'node:timers/promises';
import { UsageReader } from './agui';
import { answer } from './chat';
import { Client, RequestError, type ChatMessage, type Run } from './client';
import { loadConfig, type RunnerConfig } from './config';
import { execute } from './execute';

// The runner holds no state — the queue is the server's — so stopping it mid-task only
// means that task's lease expires and another runner picks it up.
//
// Two feeds are drained side by side per agent: triggered runs, polled, and chat
// messages, claimed by a call that waits on the server for one. A config that lists
// several agents runs that pair for each of them, in the one process.

const HEARTBEAT_MS = 60_000;
const ERROR_BACKOFF_MS = 5_000;

type Log = (message: string) => void;

function prefixOf(name: string): string {
  return name ? `[itsaplan-runner ${name}]` : '[itsaplan-runner]';
}

function log(message: string): void {
  console.log(`${prefixOf('')} ${message}`);
}

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

function taskOf(run: Run) {
  return {
    prompt: run.prompt,
    systemPrompt: run.systemPrompt,
    env: {
      ITSAPLAN_RUN_ID: String(run.id),
      ITSAPLAN_TRIGGER: run.trigger,
      ITSAPLAN_SYSTEM_PROMPT: run.systemPrompt,
      ITSAPLAN_ISSUE: run.issueIdentifier ?? '',
      ITSAPLAN_ISSUE_ID: run.issueId == null ? '' : String(run.issueId),
    },
  };
}

async function handle(config: RunnerConfig, client: Client, log: Log, run: Run): Promise<void> {
  const label = run.issueIdentifier ?? `run ${run.id}`;
  log(`${label}: started (${run.trigger})`);
  try {
    // Read as the command writes, not off the outcome: only the tail of the output is
    // kept, and the line carrying the counts can fall outside it.
    const usage = new UsageReader(config.outputFormat);
    const outcome = await withHeartbeat(
      log,
      () => client.heartbeat(run.id),
      execute(config, taskOf(run), { onData: (chunk) => usage.write(chunk) }),
    );
    usage.end();
    await client.report(run.id, { ...outcome, usage: usage.value() });
    log(`${label}: ${outcome.status}${outcome.error ? ` — ${outcome.error}` : ''}`);
  } catch (err) {
    // The command itself never throws here; this is the runner failing to run or
    // report it. Reporting the failure keeps the run from being retried blindly.
    const message = err instanceof Error ? err.message : String(err);
    log(`${label}: runner error — ${message}`);
    await client.report(run.id, { status: 'failed', error: message }).catch(() => {});
  }
}

// The stop the member pressed comes back on whichever call the runner was making: the
// events report while the command writes, the heartbeat while it is silent. Both abort
// the same controller, which kills the command.
async function handleChat(
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

// Both feeds are drained the same way; they differ in what asking for work means — a poll
// for runs, a waiting claim for chat. `onEmpty` waits before asking again, and returns
// false to give the feed up entirely.
async function drain<T>(
  state: { stopping: boolean },
  log: Log,
  concurrency: number,
  take: () => Promise<T | null>,
  run: (item: T) => Promise<void>,
  onEmpty: () => Promise<boolean>,
): Promise<void> {
  const active = new Set<Promise<void>>();
  let done = false;
  while (!state.stopping && !done) {
    if (active.size >= concurrency) {
      await Promise.race(active);
      continue;
    }
    let item: T | null = null;
    try {
      item = await take();
    } catch (err) {
      // A key the server refuses will be refused just as much on the next poll, so
      // stop instead of hiding it in a log line every few seconds.
      if (err instanceof RequestError && (err.status === 401 || err.status === 403)) throw err;
      log(`claim failed: ${String(err)}`);
      // Backing off here and not in onEmpty: a claim that waits on the server returns
      // instantly when it fails, and retrying it at that rate would hammer both sides.
      await sleep(ERROR_BACKOFF_MS);
      continue;
    }
    if (!item) {
      done = !(await onEmpty());
      continue;
    }
    const task = run(item).finally(() => active.delete(task));
    active.add(task);
  }
  await Promise.all(active);
}

function parseArgv(argv: string[]): { configPath?: string; agent?: string; args: string[] } {
  const parsed: { configPath?: string; agent?: string; args: string[] } = { args: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      parsed.args = argv.slice(i + 1);
      break;
    }
    if (arg === '--agent') {
      const value = argv[++i];
      if (value === undefined) throw new Error('--agent needs a value');
      parsed.agent = value;
      continue;
    }
    if (arg.startsWith('--agent=')) {
      parsed.agent = arg.slice('--agent='.length);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`unknown option ${arg}`);
    parsed.configPath ??= arg;
  }
  return parsed;
}

// Everything one agent needs: the two feeds, until the runner is stopped or the server
// refuses its key.
async function serve(state: { stopping: boolean }, config: RunnerConfig): Promise<void> {
  const client = new Client(config);
  const prefix = prefixOf(config.name);
  const log: Log = (message) => console.log(`${prefix} ${message}`);
  log(
    `running ${config.agent ?? 'the configured command'}, polling ${config.url} every ` +
      `${config.pollIntervalMs}ms, up to ${config.concurrency} at once`,
  );
  let chatSupported = true;
  await Promise.all([
    drain<Run>(
      state,
      log,
      config.concurrency,
      () => client.claim(),
      (run) => handle(config, client, log, run),
      async () => {
        await sleep(config.pollIntervalMs);
        return true;
      },
    ),
    // The claim already waits on the server, so an empty one means the wait ran out and
    // asking again is the whole delay there is. An instance too old to have the feed
    // answers 404, and that loop ends rather than asking forever.
    drain<ChatMessage>(
      state,
      log,
      config.concurrency,
      async () => {
        try {
          return await client.claimChat();
        } catch (err) {
          if (err instanceof RequestError && err.status === 404) {
            log('this instance has no chat feed — only queued runs will be answered');
            chatSupported = false;
            return null;
          }
          throw err;
        }
      },
      (message) => handleChat(config, client, log, message),
      () => Promise.resolve(chatSupported),
    ),
  ]);
}

async function main(): Promise<void> {
  const cli = parseArgv(process.argv.slice(2));
  const configPath =
    cli.configPath ?? process.env.ITSAPLAN_RUNNER_CONFIG ?? './itsaplan-runner.json';
  const configs = await loadConfig(configPath, { agent: cli.agent, args: cli.args });
  const state = { stopping: false };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      // The commands run in their own process groups, so quitting now leaves them running
      // with nobody to report their result: the lease expires and the run is handed out
      // again.
      if (state.stopping) {
        log('quitting now — the commands in flight keep running, their runs are retried');
        process.exit(1);
      }
      state.stopping = true;
      log('stopping — finishing the tasks in flight, press again to quit now');
    });
  }

  // One agent's key being refused says nothing about the others, so it does not take them
  // down with it; the runner still exits non-zero once they are all finished.
  const served = await Promise.all(
    configs.map((config) =>
      serve(state, config).then(
        () => true,
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${prefixOf(config.name)} stopped — ${message}`);
          return false;
        },
      ),
    ),
  );
  if (served.includes(false)) process.exit(1);
}

main().catch((err) => {
  console.error(`[itsaplan-runner] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
