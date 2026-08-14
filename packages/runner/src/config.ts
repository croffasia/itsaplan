import { readFile } from 'node:fs/promises';

// The runner's own settings, read from a JSON file and overridable by environment.
// What to execute is entirely the operator's choice: the runner passes the task on
// stdin and knows nothing about what the command does with it.

export interface RunnerConfig {
  // Where the instance lives and the external agent's API key.
  url: string;
  apiKey: string;
  // The shell command that handles one task. It receives the prompt on stdin.
  command: string;
  // Working directory for the command. Defaults to the process's own.
  cwd?: string;
  // Extra environment for the command, on top of the runner's own.
  env: Record<string, string>;
  // How many tasks to run at once.
  concurrency: number;
  // How often to ask for work when the queue was empty.
  pollIntervalMs: number;
  // How long one task may take before it is killed and reported as failed.
  timeoutMs: number;
}

const DEFAULTS = {
  concurrency: 1,
  pollIntervalMs: 3000,
  timeoutMs: 30 * 60 * 1000,
};

// An empty poll is three writes on the server (the lease sweep, the presence stamp,
// and the claim itself), so a runner asking faster than once a second costs the
// instance more than it saves its operator: a task waits at most this long anyway.
const MIN_POLL_INTERVAL_MS = 1000;

function intFrom(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function required(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${field} is required — set it in the config file or the environment`);
  return text;
}

// The config file, or nothing when there is none — a runner configured entirely by
// environment variables needs no file.
async function readConfigFile(path: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

// Reads the config file, then lets ITSAPLAN_* environment variables win over it, so
// the key can stay out of the file.
export async function loadConfig(path: string): Promise<RunnerConfig> {
  const raw = await readConfigFile(path);
  const env = process.env;
  return {
    url: required(env.ITSAPLAN_URL ?? raw.url, 'url').replace(/\/+$/, ''),
    apiKey: required(env.ITSAPLAN_API_KEY ?? raw.apiKey, 'apiKey'),
    command: required(env.ITSAPLAN_COMMAND ?? raw.command, 'command'),
    cwd: (env.ITSAPLAN_CWD ?? (raw.cwd as string | undefined))?.replace(/^~/, env.HOME ?? '~'),
    env: (raw.env as Record<string, string> | undefined) ?? {},
    concurrency: intFrom(env.ITSAPLAN_CONCURRENCY ?? raw.concurrency, DEFAULTS.concurrency),
    pollIntervalMs: Math.max(
      intFrom(env.ITSAPLAN_POLL_INTERVAL_MS ?? raw.pollIntervalMs, DEFAULTS.pollIntervalMs),
      MIN_POLL_INTERVAL_MS,
    ),
    timeoutMs: intFrom(env.ITSAPLAN_TIMEOUT_MS ?? raw.timeoutMs, DEFAULTS.timeoutMs),
  };
}
