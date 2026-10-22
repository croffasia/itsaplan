import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCES = [
  ['web', 'apps/web/src/features'],
  ['api', 'apps/api/src/modules'],
] as const;

function dirs(path: string): string[] {
  return existsSync(path)
    ? readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory())
    : [];
}

function markdownFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

export function check(root: string): string[] {
  const problems: string[] = [];
  const cellsOf = (line: string) => line.split('|').map((cell) => cell.trim());
  const mapped = readFileSync(join(root, 'docs/modules/mapping.md'), 'utf8')
    .split('\n')
    .map(cellsOf)
    .filter((cells) => cells.length >= 5 && (cells[1] === 'web' || cells[1] === 'api'));
  const rows = mapped.map((cells) => `${cells[1]}/${cells[2]}`);
  rows.forEach((row, i) => {
    if (rows.indexOf(row) !== i) problems.push(`duplicate mapping row: ${row}`);
  });

  const modules = new Set(mapped.map((cells) => cells[3]));
  const indexed = new Set(
    readFileSync(join(root, 'docs/modules/README.md'), 'utf8')
      .split('\n')
      .map(cellsOf)
      .filter((cells) => cells.length >= 5 && cells[1] !== 'Module' && !cells[1].startsWith('-'))
      .map((cells) => cells[1])
      .filter((name) => name !== '_shared'),
  );
  for (const name of modules) if (!indexed.has(name)) problems.push(`not in README index: ${name}`);
  for (const name of indexed) {
    if (!modules.has(name)) problems.push(`index row without mapping: ${name}`);
  }

  for (const [kind, path] of SOURCES) {
    for (const name of dirs(join(root, path))) {
      if (!rows.includes(`${kind}/${name}`)) problems.push(`not in mapping: ${kind}/${name}`);
    }
  }
  for (const row of rows) {
    const [kind, name] = row.split('/');
    const source = SOURCES.find(([k]) => k === kind)![1];
    if (!existsSync(join(root, source, name))) problems.push(`mapping row has no folder: ${row}`);
  }

  for (const file of markdownFiles(join(root, 'docs/modules'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, raw] of text.matchAll(/`((?:apps|packages|docs)\/[^`\s]+)`/g)) {
      const path = raw.replace(/:\d+(-\d+)?$/, '');
      if (/[*<>{}]/.test(path)) continue;
      if (!existsSync(join(root, path))) {
        problems.push(`${relative(root, file)}: missing path ${path}`);
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const problems = check(join(import.meta.dir, '../../..'));
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('OK');
}
