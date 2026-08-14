import { spawn } from 'node:child_process';
import type { Run } from './client';
import type { RunnerConfig } from './config';

// Runs one task: the configured command in a shell, with the task on stdin and the
// run's context in the environment, including the server's system prompt for commands
// that take one. Everything the agent needs beyond the task — the issue, its comments,
// its fields — it reads itself through the API or MCP with the key handed to it here.

export interface Outcome {
  status: 'success' | 'failed';
  output: string;
  error?: string;
}

// What is reported back: the tail of each stream, so a long transcript still shows its
// ending — the part that says what the agent did — without sending megabytes back.
const OUTPUT_LIMIT = 8000;
const ERROR_LIMIT = 400;

// Applied as the output arrives, so a command that prints for half an hour does not
// buffer all of it to have everything but the last few kilobytes thrown away.
function tail(text: string, limit: number): string {
  return text.length <= limit ? text : `…${text.slice(-limit)}`;
}

function childEnv(config: RunnerConfig, run: Run): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    ...config.env,
    ITSAPLAN_URL: config.url,
    ITSAPLAN_API_KEY: config.apiKey,
    ITSAPLAN_RUN_ID: String(run.id),
    ITSAPLAN_TRIGGER: run.trigger,
    ITSAPLAN_SYSTEM_PROMPT: run.systemPrompt,
    ITSAPLAN_ISSUE: run.issueIdentifier ?? '',
    ITSAPLAN_ISSUE_ID: run.issueId == null ? '' : String(run.issueId),
  };
}

// The command gets its own process group, so the Ctrl-C that stops the runner does not
// reach it — the runner promises to finish what is in flight. The timeout then has to
// kill that group itself, or a command that is a pipeline leaves its children behind.
function killGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

export async function execute(config: RunnerConfig, run: Run): Promise<Outcome> {
  const child = spawn('sh', ['-c', config.command], {
    cwd: config.cwd,
    env: childEnv(config, run),
    detached: true,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid !== undefined) killGroup(child.pid);
  }, config.timeoutMs);

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout = tail(stdout + chunk, OUTPUT_LIMIT);
  });
  child.stderr.on('data', (chunk: string) => {
    stderr = tail(stderr + chunk, ERROR_LIMIT);
  });
  // A command that ignores stdin closes the pipe before the prompt is written, which
  // is an EPIPE the runner has no reason to fail on.
  child.stdin.on('error', () => {});
  child.stdin.end(run.prompt);

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
