import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    await writeFile(
      join(dir, 'codex.cmd'),
      scriptShim('node', String.raw`node_modules\@openai\codex\bin\codex.js`),
    );
    expect(resolveCommand('codex', args, { PATH: dir }, 'win32')).toEqual([
      'node',
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
    await writeFile(
      join(dir, 'tool.cmd'),
      scriptShim('node', String.raw`node_modules\tool\bin\tool`, '--no-warnings'),
    );
    expect(resolveCommand('tool', args, { PATH: dir }, 'win32')).toEqual([
      'node',
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

  it('leaves a command that is not on the path to fail as it would', () => {
    expect(resolveCommand('claude', args, { PATH: dir }, 'win32')).toEqual(['claude', args]);
  });
});
