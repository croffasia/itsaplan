#!/usr/bin/env node
import { setTimeout as sleep } from 'node:timers/promises';
import { Client, RequestError, type ChatMessage, type Run } from './client';
import { loadConfig, type RunnerConfig } from './config';
import { startListener } from './listen';
import { handleChat, handleRun, type Log } from './tasks';

// The runner holds no state — the queue is the server's — so stopping it mid-task only
// means that task's lease expires and another runner picks it up.
//
// Two feeds are drained side by side per agent: triggered runs, polled, and chat
// messages, claimed by a call that waits on the server for one. A config that lists
// several agents runs that pair for each of them, in the one process. An agent with
// `listen` is not polled: the instance sends it its tasks on that port instead.

const ERROR_BACKOFF_MS = 5_000;

function prefixOf(name: string): string {
  return name ? `[itsaplan-runner ${name}]` : '[itsaplan-runner]';
}

function logFor(name: string): Log {
  const prefix = prefixOf(name);
  return (message) => console.log(`${prefix} ${message}`);
}

const log = logFor('');

interface State {
  stopping: boolean;
  // Settles when the runner is asked to stop, for what waits on that rather than polls.
  stopped: Promise<void>;
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

// Everything one polled agent needs: the two feeds, until the runner is stopped or the
// server refuses its key.
async function poll(state: State, config: RunnerConfig): Promise<void> {
  const client = new Client(config);
  const log = logFor(config.name);
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
      (run) => handleRun(config, client, log, run),
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

// The agents that listen on one port share its server, which tells them apart by the
// secret each request is signed with.
async function listenOn(state: State, port: number, configs: RunnerConfig[]): Promise<void> {
  const listener = await startListener(
    port,
    configs.map((config) => {
      const client = new Client(config);
      const log = logFor(config.name);
      log(
        `running ${config.agent ?? 'the configured command'} for the tasks ${config.url} ` +
          `sends to port ${port}, up to ${config.concurrency} at once`,
      );
      return {
        secret: config.signingSecret!,
        concurrency: config.concurrency,
        run: (run: Run) => handleRun(config, client, log, run),
        chat: (message: ChatMessage) => handleChat(config, client, log, message),
      };
    }),
    log,
  );
  log(`listening on port ${listener.port}`);
  await state.stopped;
  await listener.close();
}

function byPort(configs: RunnerConfig[]): Map<number, RunnerConfig[]> {
  const ports = new Map<number, RunnerConfig[]>();
  for (const config of configs) {
    if (config.listen === undefined) continue;
    ports.set(config.listen, [...(ports.get(config.listen) ?? []), config]);
  }
  return ports;
}

// Whether the work ended without an error, which is logged under the agent's name.
function settle(name: string, work: Promise<void>): Promise<boolean> {
  return work.then(
    () => true,
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${prefixOf(name)} stopped — ${message}`);
      return false;
    },
  );
}

async function main(): Promise<void> {
  const cli = parseArgv(process.argv.slice(2));
  const configPath =
    cli.configPath ?? process.env.ITSAPLAN_RUNNER_CONFIG ?? './itsaplan-runner.json';
  const configs = await loadConfig(configPath, { agent: cli.agent, args: cli.args });
  let stop!: () => void;
  const state: State = { stopping: false, stopped: new Promise((resolve) => (stop = resolve)) };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      // On macOS and Linux the commands run in their own process groups, so quitting now
      // leaves them running with nobody to report their result. On Windows they end with the
      // runner. Either way the lease expires and the run is handed out again.
      if (state.stopping) {
        log(
          process.platform === 'win32'
            ? 'quitting now — the commands in flight end, their runs are retried'
            : 'quitting now — the commands in flight keep running, their runs are retried',
        );
        process.exit(1);
      }
      state.stopping = true;
      stop();
      log('stopping — finishing the tasks in flight, press again to quit now');
    });
  }

  // One agent's key being refused says nothing about the others, so it does not take them
  // down with it; the runner still exits non-zero once they are all finished. A port that
  // cannot be opened stops the agents on it the same way.
  const served = await Promise.all([
    ...configs
      .filter((config) => config.listen === undefined)
      .map((config) => settle(config.name, poll(state, config))),
    ...[...byPort(configs)].map(([port, listening]) =>
      settle(listening.length === 1 ? listening[0]!.name : '', listenOn(state, port, listening)),
    ),
  ]);
  if (served.includes(false)) process.exit(1);
}

main().catch((err) => {
  console.error(`[itsaplan-runner] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
