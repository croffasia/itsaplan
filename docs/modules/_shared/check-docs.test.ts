import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check } from './check-docs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true })));

function fixture(mapping: string, doc = '', readme = indexRows): string {
  const root = mkdtempSync(join(tmpdir(), 'check-docs-'));
  roots.push(root);
  mkdirSync(join(root, 'apps/web/src/features/inbox'), { recursive: true });
  mkdirSync(join(root, 'apps/api/src/modules/notifications'), { recursive: true });
  mkdirSync(join(root, 'docs/modules/inbox'), { recursive: true });
  writeFileSync(join(root, 'docs/modules/mapping.md'), mapping);
  writeFileSync(join(root, 'docs/modules/inbox/README.md'), doc);
  writeFileSync(join(root, 'docs/modules/README.md'), readme);
  return root;
}

const indexRows =
  '| Module | Step | Status | Link |\n| --- | --- | --- | --- |\n| inbox | 3 | not started | - |\n';
const header = '| Kind | Folder | Module | Step |\n| --- | --- | --- | --- |\n';
const full = header + '| web | inbox | inbox | 3 |\n| api | notifications | inbox | 3 |\n';

test('accepts a complete mapping and existing paths', () => {
  const root = fixture(full, 'See `apps/web/src/features/inbox`.');
  expect(check(root)).toEqual([]);
});

test('reports a folder missing from the mapping', () => {
  const root = fixture(header + '| web | inbox | inbox | 3 |\n');
  expect(check(root).join('\n')).toContain('api/notifications');
});

test('reports a mapping row for a folder that does not exist', () => {
  const root = fixture(full + '| web | ghost | ghost | 5 |\n');
  expect(check(root).join('\n')).toContain('web/ghost');
});

test('reports a backticked path that does not exist', () => {
  const root = fixture(full, 'See `apps/web/src/features/nope`.');
  expect(check(root).join('\n')).toContain('apps/web/src/features/nope');
});

test('reports a duplicate mapping row', () => {
  const root = fixture(full + '| web | inbox | inbox | 3 |\n');
  expect(check(root).join('\n')).toContain('duplicate mapping row: web/inbox');
});

test('reports a module in the mapping that the index does not list', () => {
  const root = fixture(full, '', '| Module | Step | Status | Link |\n| --- | --- | --- | --- |\n');
  expect(check(root).join('\n')).toContain('not in README index: inbox');
});

test('reports an index row for a module the mapping does not have', () => {
  const root = fixture(full, '', indexRows + '| ghost | 5 | not started | - |\n');
  expect(check(root).join('\n')).toContain('index row without mapping: ghost');
});

test('runs from any directory', () => {
  const run = Bun.spawnSync(['bun', join(import.meta.dir, 'check-docs.ts')], { cwd: tmpdir() });
  expect(run.stderr.toString()).toBe('');
  expect(run.stdout.toString()).toContain('OK');
});
