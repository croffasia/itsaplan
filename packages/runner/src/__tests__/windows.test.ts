import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { RunnerConfig } from '../config';
import { execute } from '../execute';
import { PRESETS, presetArgv, type PresetName } from '../presets';
import { resolveCommand } from '../windows';

// The shims below follow what npm's cmd-shim writes.
const exeShim = String.raw`@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0
"%dp0%\node_modules\@anthropic-ai\claude-code\bin\claude.exe"   %*
`;

// For a script, cmd-shim takes the interpreter from the script's shebang.
function scriptShim(prog: string, target: string, progArgs = ''): string {
  const between = progArgs ? ` ${progArgs}` : '';
  return `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0

IF EXIST "%dp0%\\${prog}.exe" (
  SET "_prog=%dp0%\\${prog}.exe"
) ELSE (
  SET "_prog=${prog}"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)

endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"${between}  "%dp0%\\${target}" %*
`;
}

describe('resolveCommand', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'itsaplan-windows-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const args = ['-p', '--append-system-prompt', 'first line\nsecond line'];

  it('leaves the command as it is outside Windows', () => {
    expect(resolveCommand('claude', args, { PATH: dir }, 'linux')).toEqual(['claude', args]);
  });

  it('starts the executable that an npm shim points at, with the arguments unchanged', async () => {
    await writeFile(join(dir, 'claude.cmd'), exeShim);
    expect(resolveCommand('claude', args, { Path: `C:\\missing;${dir}` }, 'win32')).toEqual([
      join(dir, 'node_modules/@anthropic-ai/claude-code/bin/claude.exe'),
      args,
    ]);
  });

  it('starts the interpreter a script shim names, with the script', async () => {
    await mkdir(join(dir, 'node-bin'));
    await writeFile(join(dir, 'node-bin', 'node.exe'), '');
    await writeFile(
      join(dir, 'codex.cmd'),
      scriptShim('node', String.raw`node_modules\@openai\codex\bin\codex.js`),
    );
    expect(
      resolveCommand('codex', args, { PATH: `${dir};${join(dir, 'node-bin')}` }, 'win32'),
    ).toEqual([
      join(dir, 'node-bin', 'node.exe'),
      [join(dir, 'node_modules/@openai/codex/bin/codex.js'), ...args],
    ]);
  });

  it('prefers the interpreter next to a script shim', async () => {
    await writeFile(
      join(dir, 'codex.cmd'),
      scriptShim('node', String.raw`node_modules\codex\cli.js`),
    );
    await writeFile(join(dir, 'node.exe'), '');
    expect(resolveCommand('codex', args, { PATH: dir }, 'win32')[0]).toBe(join(dir, 'node.exe'));
  });

  it('starts a bun script with the bun found on the path', async () => {
    await mkdir(join(dir, 'bun-bin'));
    await writeFile(join(dir, 'bun-bin', 'bun.exe'), '');
    await writeFile(
      join(dir, 'omp.cmd'),
      scriptShim('bun', String.raw`node_modules\omp\dist\cli.js`),
    );
    expect(
      resolveCommand('omp', args, { PATH: `${dir};${join(dir, 'bun-bin')}` }, 'win32'),
    ).toEqual([
      join(dir, 'bun-bin', 'bun.exe'),
      [join(dir, 'node_modules/omp/dist/cli.js'), ...args],
    ]);
  });

  it('starts a script with no extension through its interpreter, with the shebang arguments', async () => {
    await mkdir(join(dir, 'node-bin'));
    await writeFile(join(dir, 'node-bin', 'node.exe'), '');
    await writeFile(
      join(dir, 'tool.cmd'),
      scriptShim('node', String.raw`node_modules\tool\bin\tool`, '--no-warnings'),
    );
    expect(
      resolveCommand('tool', args, { PATH: `${dir};${join(dir, 'node-bin')}` }, 'win32'),
    ).toEqual([
      join(dir, 'node-bin', 'node.exe'),
      ['--no-warnings', join(dir, 'node_modules/tool/bin/tool'), ...args],
    ]);
  });

  it('starts an executable found on the path directly', async () => {
    await mkdir(join(dir, 'bin'));
    await writeFile(join(dir, 'bin', 'claude.exe'), '');
    expect(resolveCommand('claude', args, { PATH: join(dir, 'bin') }, 'win32')).toEqual([
      join(dir, 'bin', 'claude.exe'),
      args,
    ]);
  });

  it('reads the same PATH variant the child gets', async () => {
    await mkdir(join(dir, 'upper'));
    await mkdir(join(dir, 'mixed'));
    await writeFile(join(dir, 'upper', 'claude.exe'), '');
    await writeFile(join(dir, 'mixed', 'claude.exe'), '');
    const env = { Path: join(dir, 'mixed'), PATH: join(dir, 'upper') };
    expect(resolveCommand('claude', args, env, 'win32')[0]).toBe(join(dir, 'upper', 'claude.exe'));
  });

  it('refuses a batch file that names no target', async () => {
    await writeFile(join(dir, 'claude.cmd'), '@echo off\r\nclaude-real %*\r\n');
    expect(() => resolveCommand('claude', args, { PATH: dir }, 'win32')).toThrow(/cmd\.exe/);
  });

  it('reads a quoted directory on the path', async () => {
    await mkdir(join(dir, 'bin'));
    await writeFile(join(dir, 'bin', 'claude.exe'), '');
    expect(resolveCommand('claude', args, { PATH: `"${join(dir, 'bin')}"` }, 'win32')[0]).toBe(
      join(dir, 'bin', 'claude.exe'),
    );
  });

  it('refuses a command that is not on the path', () => {
    expect(() => resolveCommand('claude', args, { PATH: dir }, 'win32')).toThrow(/not on PATH/);
  });

  it('refuses a script shim whose interpreter is not on the path', async () => {
    await writeFile(
      join(dir, 'codex.cmd'),
      scriptShim('node', String.raw`node_modules\codex\cli.js`),
    );
    expect(() => resolveCommand('codex', args, { PATH: dir }, 'win32')).toThrow(
      /node is not on PATH/,
    );
  });
});

// A CLI that npm installed: a node script behind a .cmd shim. `echo` reports its arguments
// and stdin. The other modes start an idle process and report both pids: `tree` keeps
// running, `leave` exits while the idle process holds stdout, and `orphan` starts `leave`
// and keeps running. The idle process is detached, so the job object that Node puts a
// child in does not end it with its parent, and only taskkill /t can.
const fakeCli = String.raw`const { spawn } = require('node:child_process');
const start = (mode, stdio) =>
  spawn(process.execPath, [__filename], {
    detached: mode === 'idle',
    stdio,
    env: { ...process.env, FAKE_CLI_MODE: mode },
  });
const report = (child, then) =>
  process.stdout.write(JSON.stringify({ pid: process.pid, child: child.pid }) + '\n', then);
switch (process.env.FAKE_CLI_MODE) {
  case 'echo': {
    let stdin = '';
    process.stdin.setEncoding('utf8').on('data', (chunk) => (stdin += chunk));
    process.stdin.on('end', () =>
      process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), stdin })),
    );
    break;
  }
  case 'tree':
    report(start('idle', 'ignore'));
    setInterval(() => {}, 1000);
    break;
  case 'leave':
    report(start('idle', ['ignore', 'inherit', 'ignore']), () => process.exit(0));
    break;
  case 'orphan':
    start('leave', ['ignore', 'inherit', 'ignore']);
    setInterval(() => {}, 1000);
    break;
  case 'idle':
    setInterval(() => {}, 1000);
}
`;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function gone(pid: number): Promise<boolean> {
  for (let i = 0; i < 20 && alive(pid); i++) await sleep(100);
  return !alive(pid);
}

function pidsIn(output: string): { pid: number; child: number } {
  return JSON.parse(output.split('\n')[0]);
}

describe.skipIf(process.platform !== 'win32')('execute on Windows', () => {
  let dir: string;
  let seen: string;
  const onData = (chunk: string) => {
    seen += chunk;
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'itsaplan-windows-'));
    seen = '';
    await mkdir(join(dir, 'node_modules', 'fake-cli'), { recursive: true });
    await writeFile(join(dir, 'node_modules', 'fake-cli', 'cli.js'), fakeCli);
    for (const bin of ['claude', 'omp']) {
      await writeFile(
        join(dir, `${bin}.cmd`),
        scriptShim('node', String.raw`node_modules\fake-cli\cli.js`),
      );
    }
  });

  afterEach(async () => {
    for (const [, pid] of seen.matchAll(/"(?:pid|child)":(\d+)/g)) {
      if (alive(Number(pid))) process.kill(Number(pid));
    }
    await rm(dir, { recursive: true, force: true });
  });

  const config = (agent: PresetName, mode: string, timeoutMs: number, args: string[] = []) =>
    ({
      name: '',
      url: 'http://plan.test',
      apiKey: 'test',
      agent,
      args,
      env: { PATH: `${dir};${process.env.PATH}`, FAKE_CLI_MODE: mode },
      concurrency: 1,
      pollIntervalMs: 1000,
      timeoutMs,
      outputFormat: 'text',
    }) satisfies RunnerConfig;

  const task = { prompt: 'Do the task.', systemPrompt: '', env: {} };

  it('passes a multiline system prompt and other arguments to the CLI unchanged', async () => {
    const systemPrompt =
      'You work on PLAN-1.\n"Quoted", a tab\there, a trailing backslash\\\n%PATH% & | < > ^ ! → ✓ проверка';
    const prompt = 'Do the task.\nSecond line.';
    const args = ['--model', 'with "quotes" and spaces', '', 'C:\\dir with space\\', '100%'];
    // Claude Code reads the task on stdin, omp as the last argument.
    for (const agent of ['claude', 'omp'] as const) {
      const result = await execute(config(agent, 'echo', 10_000, args), {
        prompt,
        systemPrompt,
        env: {},
      });
      expect(result.status).toBe('success');
      expect(JSON.parse(result.output)).toEqual({
        argv: presetArgv(PRESETS[agent], null, systemPrompt, args, prompt),
        stdin: PRESETS[agent].promptVia === 'stdin' ? prompt : '',
      });
    }
  });

  it('ends the CLI and the process it started on the timeout', async () => {
    const result = await execute(config('claude', 'tree', 2000), task, { onData });
    expect(result).toMatchObject({ status: 'failed', error: 'Timed out after 2000ms' });
    const { pid, child } = pidsIn(result.output);
    expect(await gone(pid)).toBe(true);
    expect(await gone(child)).toBe(true);
  }, 15_000);

  it('ends the CLI and the process it started when the answer is stopped', async () => {
    const stop = new AbortController();
    const result = await execute(config('claude', 'tree', 60_000), task, {
      signal: stop.signal,
      onData: (chunk) => {
        onData(chunk);
        stop.abort();
      },
    });
    expect(result.status).toBe('failed');
    const { pid, child } = pidsIn(result.output);
    expect(await gone(pid)).toBe(true);
    expect(await gone(child)).toBe(true);
  }, 15_000);

  // The process still runs and still holds stdout when execute returns: the runner stops
  // reading instead of waiting for it.
  it('does not wait for a process the CLI left with stdout open after it exited', async () => {
    const started = Date.now();
    const result = await execute(config('claude', 'leave', 1000), task, { onData });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.status).toBe('success');
    expect(alive(pidsIn(result.output).child)).toBe(true);
  }, 15_000);

  it('does not wait for a process that outlived its parent when the CLI is ended', async () => {
    const started = Date.now();
    const result = await execute(config('claude', 'orphan', 2000), task, { onData });
    expect(Date.now() - started).toBeLessThan(6000);
    expect(result).toMatchObject({ status: 'failed', error: 'Timed out after 2000ms' });
    expect(alive(pidsIn(result.output).child)).toBe(true);
  }, 15_000);
});
