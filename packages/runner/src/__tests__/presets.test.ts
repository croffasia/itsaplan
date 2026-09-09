import { describe, it, expect } from 'bun:test';
import { PRESETS, presetArgv, presetPrompt } from '../presets';

// The preset is what makes a session survive between messages, so the argument it builds
// for each CLI is pinned here: getting the resume spelling wrong is silent — the command
// runs, it just starts over every time.

describe('preset arguments', () => {
  it('starts Claude Code without a session and resumes the one it is given', () => {
    const fresh = presetArgv(PRESETS.claude, null, 'context', [], 'do it');
    expect(fresh).not.toContain('--resume');
    expect(fresh).toContain('--output-format');

    const resumed = presetArgv(PRESETS.claude, 'abc-123', 'context', [], 'do it');
    expect(resumed.slice(0, 3)).toEqual(['-p', '--resume', 'abc-123']);
  });

  it("puts Codex's resume in front, as the subcommand it is, and keeps the stdin marker last", () => {
    const fresh = presetArgv(PRESETS.codex, null, '', [], 'do it');
    expect(fresh[0]).toBe('exec');
    expect(fresh.at(-1)).toBe('-');

    const resumed = presetArgv(PRESETS.codex, '01a0', '', ['--model', 'gpt-5'], 'do it');
    expect(resumed.slice(0, 3)).toEqual(['exec', 'resume', '01a0']);
    expect(resumed.at(-1)).toBe('-');
    // The operator's own arguments sit before the marker, never after it.
    expect(resumed.indexOf('--model')).toBeLessThan(resumed.length - 1);
  });

  it('gives opencode the task as the last argument, after the session flag', () => {
    const argv = presetArgv(PRESETS.opencode, 'ses_1', '', [], 'do it');
    expect(argv).toContain('--session');
    expect(argv.at(-1)).toBe('do it');
  });

  it('resumes an Antigravity conversation and keeps the task behind -p', () => {
    const fresh = presetArgv(PRESETS.antigravity, null, '', [], 'do it');
    expect(fresh).not.toContain('--conversation');
    expect(fresh.at(-2)).toBe('-p');

    const resumed = presetArgv(PRESETS.antigravity, 'c3b6', '', [], 'do it');
    expect(resumed.slice(0, 2)).toEqual(['--conversation', 'c3b6']);
    expect(resumed.at(-1)).toBe('do it');
  });

  it('resumes a Copilot session by id, keeping the task behind -p', () => {
    const fresh = presetArgv(PRESETS.copilot, null, '', [], 'do it');
    expect(fresh).not.toContain('--session-id');
    expect(fresh.at(-2)).toBe('-p');

    const resumed = presetArgv(PRESETS.copilot, 'c66bf000', '', [], 'do it');
    expect(resumed.slice(-4)).toEqual(['--session-id', 'c66bf000', '-p', 'do it']);
  });

  it("appends the operator's arguments after the preset's, so a repeated flag wins", () => {
    const argv = presetArgv(PRESETS.claude, null, '', ['--permission-mode', 'plan'], 'do it', true);
    expect(argv.lastIndexOf('--permission-mode')).toBeGreaterThan(
      argv.indexOf('--permission-mode'),
    );
    expect(argv.at(-1)).toBe('plan');
  });

  // The task is text anyone in the project can write, so the gate that would ask before
  // it runs a command stays closed unless the operator opens it.
  it("leaves every CLI's approval gate on unless the operator opts out of it", () => {
    const gates = [
      '--permission-mode',
      '--dangerously-skip-permissions',
      '--allow-all-tools',
      '--dangerously-bypass-approvals-and-sandbox',
      '--full-auto',
      '--yolo',
    ];
    for (const preset of Object.values(PRESETS)) {
      const argv = presetArgv(preset, null, 'context', [], 'do it');
      for (const gate of gates) expect(argv).not.toContain(gate);
      expect(argv).not.toContain('auto');
    }

    const claude = presetArgv(PRESETS.claude, null, 'context', [], 'do it', true);
    const mode = claude.indexOf('--permission-mode');
    expect(claude.slice(mode, mode + 2)).toEqual(['--permission-mode', 'auto']);
    expect(presetArgv(PRESETS.antigravity, null, '', [], 'do it', true)).toContain(
      '--dangerously-skip-permissions',
    );
    const copilot = presetArgv(PRESETS.copilot, null, '', [], 'do it', true);
    expect(copilot).toContain('--allow-all-tools');
    expect(copilot).toContain('--no-ask-user');
  });

  it('passes the system prompt by flag where there is one and in front of the task otherwise', () => {
    const claude = presetArgv(PRESETS.claude, null, 'context', [], 'do it');
    expect(claude).toContain('--append-system-prompt');
    expect(claude).toContain('context');
    expect(presetPrompt(PRESETS.claude, 'context', 'do it')).toBe('do it');

    expect(presetPrompt(PRESETS.codex, 'context', 'do it')).toBe('context\n\ndo it');
    expect(presetArgv(PRESETS.opencode, null, 'context', [], 'do it').at(-1)).toBe(
      'context\n\ndo it',
    );
  });

  it('leaves the task alone on a resumed session, where the context is already held', () => {
    expect(presetPrompt(PRESETS.codex, '', 'do it')).toBe('do it');
    expect(presetArgv(PRESETS.claude, 'abc', '', [], 'do it')).not.toContain(
      '--append-system-prompt',
    );
  });
});
