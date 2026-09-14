import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../shared/lib';

// Files a dump as a markdown note in a directory the operator mounts into the API
// container (OBSIDIAN_VAULT_DIR), which is the vault — or a folder synced into it.
// Nothing reads the vault back; this only writes.

// The note name is derived from a user-supplied title, so it is reduced to a flat
// slug by an allowlist: letters, digits, spaces and a little punctuation survive,
// and everything else — path separators, control characters, wildcards — becomes a
// space. An empty result falls back to a fixed name rather than producing a dotfile
// or an empty filename.
export function noteSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ._,()'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return slug.length > 0 ? slug : 'Untitled dump';
}

function frontmatterValue(value: string): string {
  return JSON.stringify(value);
}

export function renderNote(entry: {
  title: string;
  body: string;
  kind: string;
  tags: string[];
  createdAt: string;
  author: string | null;
}): string {
  const lines = [
    '---',
    `title: ${frontmatterValue(entry.title)}`,
    `kind: ${entry.kind}`,
    `created: ${entry.createdAt}`,
    'source: braindump',
  ];
  if (entry.author) lines.push(`author: ${frontmatterValue(entry.author)}`);
  if (entry.tags.length > 0) {
    lines.push('tags:');
    for (const tag of entry.tags) lines.push(`  - ${frontmatterValue(tag)}`);
  }
  lines.push('---', '', `# ${entry.title}`, '', entry.body.trim(), '');
  return lines.join('\n');
}

export function obsidianConfigured(): boolean {
  return Boolean(process.env.OBSIDIAN_VAULT_DIR);
}

// Writes the note and returns the path relative to the vault directory, which is
// what the UI shows. The absolute path is resolved and checked to still sit directly
// inside the vault, so a crafted title cannot escape it even if the slug rules change.
export async function writeNote(entryId: number, markdown: string, title: string): Promise<string> {
  const vault = process.env.OBSIDIAN_VAULT_DIR;
  if (!vault) throw new HttpError(503, 'Obsidian is not configured on this instance');

  const root = path.resolve(vault);
  const day = new Date().toISOString().slice(0, 10);
  // The entry id keeps two dumps with the same title on the same day apart.
  const filename = `${day} ${noteSlug(title)} (${entryId}).md`;
  const target = path.resolve(root, filename);
  if (path.dirname(target) !== root) {
    throw new HttpError(400, 'Note name resolves outside the vault directory');
  }

  try {
    await mkdir(root, { recursive: true });
    await writeFile(target, markdown, { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new HttpError(409, 'A note with this name already exists');
    }
    throw new HttpError(502, 'Could not write the note to the vault directory');
  }
  return filename;
}
