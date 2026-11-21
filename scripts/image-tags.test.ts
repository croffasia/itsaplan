import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

function shellEscape(value: string): string {
  return `$'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')}'`;
}

function resolveTags(args: string[]) {
  // Pass arguments as ANSI-C quoted literals in a single `-c` string so Windows'
  // WSL bash.exe wrapper does not split embedded newlines across shell lines.
  const command = ['bash', 'scripts/image-tags.sh', ...args.map(shellEscape)].join(' ');
  const result = Bun.spawnSync(['bash', '-c', command], { cwd: root });
  const stdout = result.stdout.toString().trim();
  return {
    exitCode: result.exitCode,
    tags: stdout ? stdout.split(/\r?\n/) : [],
    stderr: result.stderr.toString().trim(),
  };
}

describe('image-tags.sh', () => {
  test('emits exact, minor, major, and latest tags for stable >= 1.0.0 releases', () => {
    expect(resolveTags(['v1.11.0'])).toEqual({
      exitCode: 0,
      tags: ['1.11.0', '1.11', '1', 'latest'],
      stderr: '',
    });
    expect(resolveTags(['v1.12.0'])).toEqual({
      exitCode: 0,
      tags: ['1.12.0', '1.12', '1', 'latest'],
      stderr: '',
    });
    expect(resolveTags(['v2.0.0'])).toEqual({
      exitCode: 0,
      tags: ['2.0.0', '2.0', '2', 'latest'],
      stderr: '',
    });
  });

  test('accepts bare semver input without a leading v', () => {
    expect(resolveTags(['1.11.0'])).toEqual({
      exitCode: 0,
      tags: ['1.11.0', '1.11', '1', 'latest'],
      stderr: '',
    });
  });

  test('omits the major tag for 0.x releases', () => {
    expect(resolveTags(['v0.10.1'])).toEqual({
      exitCode: 0,
      tags: ['0.10.1', '0.10', 'latest'],
      stderr: '',
    });
  });

  test('emits only the exact tag for prereleases', () => {
    expect(resolveTags(['v1.2.3-rc.1'])).toEqual({
      exitCode: 0,
      tags: ['1.2.3-rc.1'],
      stderr: '',
    });
    expect(resolveTags(['v0.10.1-alpha.1'])).toEqual({
      exitCode: 0,
      tags: ['0.10.1-alpha.1'],
      stderr: '',
    });
  });

  test('rejects missing, empty, or non-semver tags', () => {
    for (const args of [
      [],
      [''],
      ['main'],
      ['latest'],
      ['v1.2'],
      ['v01.2.3'],
      ['v1.2.3-'],
      ['v1.2.3-rc.'],
      ['v1.2.3+build.1'],
      ['v1.2.3\nfoo'],
      ['v1.2.3', 'extra'],
    ]) {
      const result = resolveTags(args);
      expect(result.exitCode).toBe(1);
      expect(result.tags).toEqual([]);
      expect(result.stderr).not.toBe('');
    }
  });
});
