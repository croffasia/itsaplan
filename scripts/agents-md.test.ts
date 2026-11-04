import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const MAX_BYTES = 10_000;

const tracked = Bun.spawnSync(['git', 'ls-files'], { cwd: ROOT }).stdout.toString().split('\n');
const agentFiles = tracked.filter((file) => /(^|\/)AGENTS\.md$/.test(file));

const fileReference = /^\w[\w./-]*\.(ts|tsx|json|sql|md|yml|yaml|sh|mjs|css)$/;
const rootReference = /^(apps|packages|docs|scripts|charts|\.github)\/[\w./-]+$/;

// Backticked file names with no folder resolve against any tracked file, since a rule often
// names one by its base name. Forms with a wildcard or a placeholder are skipped.
function missingReferences(file: string): string[] {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const references = [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].replace(/\/$/, ''));
  return references
    .filter((ref) => fileReference.test(ref) || rootReference.test(ref))
    .filter(
      (ref) =>
        !existsSync(join(ROOT, ref)) &&
        !existsSync(join(ROOT, dirname(file), ref)) &&
        !tracked.some((path) => path.endsWith(`/${ref}`) || path.includes(`/${ref}/`)),
    );
}

describe('AGENTS.md files', () => {
  test('the set of files is found', () => {
    expect(agentFiles).toContain('AGENTS.md');
  });

  for (const file of agentFiles) {
    test(`${file} stays within the size limit (see docs/dev/agents-md.md)`, () => {
      expect(statSync(join(ROOT, file)).size).toBeLessThanOrEqual(MAX_BYTES);
    });

    test(`${file} names only paths that exist`, () => {
      expect(missingReferences(file)).toEqual([]);
    });
  }
});
