import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCommand } from '../windows';

// The shims below follow what npm's cmd-shim writes.
const exeShim = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0
"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*
`;

const scriptShim = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0

IF EXIST "%dp0%\\node.exe" (
  SET "_prog=%dp0%\\node.exe"
) ELSE (
  SET "_prog=node"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)

endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*
`;

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

  it('starts node with the script that an npm shim points at', async () => {
    await writeFile(join(dir, 'codex.cmd'), scriptShim);
    const [bin, argv] = resolveCommand('codex', args, { PATH: dir }, 'win32');
    expect(bin).toBe(process.execPath);
    expect(argv).toEqual([join(dir, 'node_modules/@openai/codex/bin/codex.js'), ...args]);
  });

  it('prefers the node.exe next to a script shim', async () => {
    await writeFile(join(dir, 'codex.cmd'), scriptShim);
    await writeFile(join(dir, 'node.exe'), '');
    expect(resolveCommand('codex', args, { PATH: dir }, 'win32')[0]).toBe(join(dir, 'node.exe'));
  });

  it('starts an executable found on the path directly', async () => {
    await mkdir(join(dir, 'bin'));
    await writeFile(join(dir, 'bin', 'claude.exe'), '');
    expect(resolveCommand('claude', args, { PATH: join(dir, 'bin') }, 'win32')).toEqual([
      join(dir, 'bin', 'claude.exe'),
      args,
    ]);
  });

  it('refuses a batch file that names no target', async () => {
    await writeFile(join(dir, 'claude.cmd'), '@echo off\r\nclaude-real %*\r\n');
    expect(() => resolveCommand('claude', args, { PATH: dir }, 'win32')).toThrow(/cmd\.exe/);
  });

  it('leaves a command that is not on the path to fail as it would', () => {
    expect(resolveCommand('claude', args, { PATH: dir }, 'win32')).toEqual(['claude', args]);
  });
});
