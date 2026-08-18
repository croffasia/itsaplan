import { readFile } from 'node:fs/promises';
import { PRESETS, PRESET_NAMES, isPresetName, type Preset, type PresetName } from './presets';

// Two ways to say what to run. `agent` names a CLI the runner knows (see presets.ts) and
// the runner builds the invocation, which is what lets it resume that CLI's sessions.
// `command` is a shell command the operator writes themselves, and no session is kept for
// it. `command` wins where both are set.

export interface RunnerConfig {
  url: string;
  apiKey: string;
  agent?: PresetName;
  // Receives the prompt on stdin.
  command?: string;
  // Appended to what the preset builds. Ignored with `command`, which already spells out
  // the whole invocation.
  args: string[];
  // Defaults to the process's own.
  cwd?: string;
  // On top of the runner's own environment.
  env: Record<string, string>;
  concurrency: number;
  // How often to ask for work when the queue was empty.
  pollIntervalMs: number;
  // How long one task may take before it is killed and reported as failed.
  timeoutMs: number;
  // How the output is read when the command answers a chat message. 'text' takes whatever
  // it prints; the others read one CLI's own event stream, which also carries the tool
  // calls it makes and the session it started.
  outputFormat: OutputFormat;
}

const OUTPUT_FORMATS = ['text', 'claude-stream-json', 'codex-jsonl', 'opencode-json'] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

// The preset a config resolves to, or undefined when it runs the operator's own command.
export function presetOf(config: Pick<RunnerConfig, 'agent' | 'command'>): Preset | undefined {
  if (config.command || !config.agent) return undefined;
  return PRESETS[config.agent];
}

const DEFAULTS = {
  concurrency: 1,
  pollIntervalMs: 3000,
  timeoutMs: 30 * 60 * 1000,
};

// An empty poll is three writes on the server (the lease sweep, the presence stamp, and
// the claim itself), so asking faster than once a second costs the instance more than it
// saves its operator.
const MIN_POLL_INTERVAL_MS = 1000;

function intFrom(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// The preset's own format unless the operator names one.
function outputFormatFrom(value: unknown, preset: Preset | undefined): OutputFormat {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return preset?.outputFormat ?? 'text';
  const format = OUTPUT_FORMATS.find((candidate) => candidate === name);
  if (!format) {
    throw new Error(`outputFormat must be one of ${OUTPUT_FORMATS.join(', ')}`);
  }
  return format;
}

function agentFrom(value: unknown): PresetName | undefined {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return undefined;
  if (!isPresetName(name)) {
    throw new Error(`agent must be one of ${PRESET_NAMES.join(', ')}`);
  }
  return name;
}

function argsFrom(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('args must be an array of strings');
  }
  return value as string[];
}

function required(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${field} is required — set it in the config file or the environment`);
  return text;
}

// A runner configured entirely by environment variables needs no file.
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

// What the command line contributed, which wins over both the file and the environment.
export interface ConfigOverrides {
  agent?: string;
  // The arguments after `--`, appended to the ones the config file already gives.
  args?: string[];
}

// ITSAPLAN_* environment variables win over the file, so the key can stay out of it, and
// the command line wins over both.
export async function loadConfig(
  path: string,
  overrides: ConfigOverrides = {},
): Promise<RunnerConfig> {
  const raw = await readConfigFile(path);
  const env = process.env;
  const agent = agentFrom(overrides.agent ?? env.ITSAPLAN_AGENT ?? raw.agent);
  const command =
    (env.ITSAPLAN_COMMAND ?? (raw.command as string | undefined))?.trim() || undefined;
  if (!agent && !command) {
    throw new Error(
      `set either agent (one of ${PRESET_NAMES.join(', ')}) or command in the config file or the environment`,
    );
  }
  return {
    url: required(env.ITSAPLAN_URL ?? raw.url, 'url').replace(/\/+$/, ''),
    apiKey: required(env.ITSAPLAN_API_KEY ?? raw.apiKey, 'apiKey'),
    agent,
    command,
    args: [...argsFrom(raw.args), ...(overrides.args ?? [])],
    cwd: (env.ITSAPLAN_CWD ?? (raw.cwd as string | undefined))?.replace(/^~/, env.HOME ?? '~'),
    env: (raw.env as Record<string, string> | undefined) ?? {},
    concurrency: intFrom(env.ITSAPLAN_CONCURRENCY ?? raw.concurrency, DEFAULTS.concurrency),
    pollIntervalMs: Math.max(
      intFrom(env.ITSAPLAN_POLL_INTERVAL_MS ?? raw.pollIntervalMs, DEFAULTS.pollIntervalMs),
      MIN_POLL_INTERVAL_MS,
    ),
    timeoutMs: intFrom(env.ITSAPLAN_TIMEOUT_MS ?? raw.timeoutMs, DEFAULTS.timeoutMs),
    outputFormat: outputFormatFrom(
      env.ITSAPLAN_OUTPUT_FORMAT ?? raw.outputFormat,
      presetOf({ agent, command }),
    ),
  };
}
