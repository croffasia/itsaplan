import { spawn, spawnSync } from 'node:child_process';
import { presetOf, type RunnerConfig } from './config';
import { presetArgv, presetPrompt, type Preset } from './presets';
import { resolveCommand } from './windows';

// Runs one task: the command the preset builds, or the operator's own in a shell, with the
// task on stdin and its context in the environment. Everything the agent needs beyond the
// task — the issue, its comments, its fields — it reads itself through the API or MCP with
// the key handed to it here.

// A queued run and a chat message differ only in these.
export interface Task {
  prompt: string;
  // A preset with no flag for it puts this in front of the prompt; the operator's own
  // command reads it from the environment.
  systemPrompt: string;
  env: Record<string, string>;
  // The coding agent session to resume, for a preset that keeps them.
  sessionId?: string | null;
}

export interface Outcome {
  status: 'success' | 'failed';
  output: string;
  error?: string;
}

// Only the tail of each stream is reported, so a long transcript still shows its ending —
// the part that says what the agent did — without sending megabytes back.
const OUTPUT_LIMIT = 8000;
const ERROR_LIMIT = 400;

// How long the output of a command that was ended on Windows is still read after it exits.
const OUTPUT_GRACE_MS = 1000;

// Applied as the output arrives, so a command that prints for half an hour does not buffer
// all of it to have everything but the last few kilobytes thrown away.
function tail(text: string, limit: number): string {
  return text.length <= limit ? text : `…${text.slice(-limit)}`;
}

function childEnv(config: RunnerConfig, task: Task): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    ...config.env,
    ITSAPLAN_URL: config.url,
    ITSAPLAN_API_KEY: config.apiKey,
    ...task.env,
    ITSAPLAN_TIMEOUT_MS: String(config.timeoutMs),
  };
}

// The command gets its own process group (on Windows, its own hidden console), so the
// Ctrl-C that stops the runner does not reach it — the runner promises to finish what is
// in flight. The timeout and the member's stop then have to kill that group themselves,
// or a command that is a pipeline leaves its children behind. Windows cannot signal a
// group, so taskkill ends the process tree instead.
function killGroup(pid: number): void {
  if (process.platform === 'win32') {
    // A bare name is looked up in the current directory first, and the agent can write there.
    const taskkill = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\taskkill.exe`;
    spawnSync(taskkill, ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

// A preset is spawned directly, with no shell in between: the session id and the
// operator's arguments reach the command as they are, with nothing to quote. The
// operator's own command goes through a shell, which is what it was written for.
function spawnArgs(
  config: RunnerConfig,
  preset: Preset | undefined,
  task: Task,
  env: Record<string, string>,
): [string, string[]] {
  if (!preset) return ['sh', ['-c', config.command ?? '']];
  return resolveCommand(
    preset.bin,
    presetArgv(preset, task.sessionId ?? null, task.systemPrompt, config.args, task.prompt),
    env,
  );
}

// A CLI that took the task as an argument would read it twice if it also arrived here.
function stdinText(preset: Preset | undefined, task: Task): string {
  if (!preset) return task.prompt;
  if (preset.promptVia === 'arg') return '';
  return presetPrompt(preset, task.systemPrompt, task.prompt);
}

// `onData` sees stdout as it arrives, for a caller that reports the output while the
// command is still running. `signal` ends the command the way the timeout does, for a
// chat answer the member stopped.
export async function execute(
  config: RunnerConfig,
  task: Task,
  opts: { onData?: (chunk: string) => void; signal?: AbortSignal } = {},
): Promise<Outcome> {
  const preset = presetOf(config);
  const env = childEnv(config, task);
  const [bin, args] = spawnArgs(config, preset, task, env);
  // On Windows `detached` would drop the hidden console that windowsHide gives the
  // command, and every console program it starts would open a window.
  const child = spawn(bin, args, {
    cwd: config.cwd,
    env,
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  // Windows frees the pid when the command exits, and taskkill would then reach whatever
  // process got it next. taskkill also finds a tree through the parents that still run, so
  // a process that outlived its parent is out of its reach and can hold stdout open for as
  // long as it runs. After a timeout or a stop on Windows, the runner therefore stops
  // reading the output shortly after the command exits.
  const stopReading = () => {
    setTimeout(() => {
      child.stdout.destroy();
      child.stderr.destroy();
    }, OUTPUT_GRACE_MS).unref();
  };
  const kill = () => {
    if (child.pid === undefined) return;
    if (process.platform !== 'win32') {
      killGroup(child.pid);
    } else if (child.exitCode === null && child.signalCode === null) {
      killGroup(child.pid);
      child.once('exit', stopReading);
    } else {
      stopReading();
    }
  };
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    kill();
  }, config.timeoutMs);
  opts.signal?.addEventListener('abort', kill, { once: true });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout = tail(stdout + chunk, OUTPUT_LIMIT);
    opts.onData?.(chunk);
  });
  child.stderr.on('data', (chunk: string) => {
    stderr = tail(stderr + chunk, ERROR_LIMIT);
  });
  // A command that ignores stdin closes the pipe before the prompt is written, which is an
  // EPIPE the runner has no reason to fail on.
  child.stdin.on('error', () => {});
  child.stdin.end(stdinText(preset, task));

  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (exitCode, exitSignal) => resolve({ code: exitCode, signal: exitSignal }));
  });

  let code: number | null;
  let signal: string | null;
  try {
    ({ code, signal } = await exited);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', kill);
  }

  const output = stdout.trim();
  if (code === 0) return { status: 'success', output };
  // The timeout says more about the failure than whatever the command printed.
  if (timedOut) return { status: 'failed', output, error: `Timed out after ${config.timeoutMs}ms` };
  return {
    status: 'failed',
    output,
    error:
      stderr.trim() || (signal ? `Command killed by ${signal}` : `Command exited with ${code}`),
  };
}
