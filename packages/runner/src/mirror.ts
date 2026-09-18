import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

const DEFAULT_OUT = './itsaplan-mirror';
const DEFAULT_INTERVAL_MS = 5000;
const MIN_INTERVAL_MS = 1000;

export interface MirrorArgs {
  out: string;
  url?: string;
  key?: string;
  config?: string;
  watch: boolean;
  intervalMs: number;
  git: boolean;
  archived: boolean;
  help: boolean;
}

export function parseMirrorArgs(argv: string[]): MirrorArgs {
  const args: MirrorArgs = {
    out: DEFAULT_OUT,
    watch: false,
    intervalMs: DEFAULT_INTERVAL_MS,
    git: false,
    archived: false,
    help: false,
  };
  const valued: Record<string, (value: string) => void> = {
    '--out': (v) => {
      args.out = v;
    },
    '--url': (v) => {
      args.url = v;
    },
    '--key': (v) => {
      args.key = v;
    },
    '--config': (v) => {
      args.config = v;
    },
    '--interval': (v) => {
      args.intervalMs = Math.max(Number.parseInt(v, 10) || DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS);
    },
  };
  const flags: Record<string, () => void> = {
    '--watch': () => {
      args.watch = true;
    },
    '--git': () => {
      args.git = true;
    },
    '--archived': () => {
      args.archived = true;
    },
    '--help': () => {
      args.help = true;
    },
    '-h': () => {
      args.help = true;
    },
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (name in valued) {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined) throw new Error(`${name} needs a value`);
      valued[name](value);
    } else if (arg in flags) {
      flags[arg]();
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  return args;
}

// Same rule as the API's export route, so a mirrored file is named like a downloaded one.
export function stemOf(title: string): string {
  const printable = [...title.trim()]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '-' : character;
    })
    .join('');
  return printable.replace(/[<>:"/\\|?*]/g, '-').slice(0, 120) || 'untitled';
}

export interface DocSummary {
  id: number;
  parentId: number | null;
  title: string;
  position: number;
  version: number;
  updatedAt: string;
  archivedAt: string | null;
}

export function planDocumentPaths(docs: DocSummary[]): Map<number, string> {
  const ids = new Set(docs.map((d) => d.id));
  const parentOf = (d: DocSummary) =>
    d.parentId !== null && ids.has(d.parentId) ? d.parentId : null;
  const byParent = new Map<number | null, DocSummary[]>();
  for (const d of docs) byParent.set(parentOf(d), [...(byParent.get(parentOf(d)) ?? []), d]);
  const stems = new Map<number, string>();
  // A title of "." or ".." survives stemOf (it has no reserved characters) but would name a
  // traversal segment once it becomes a folder, so it is neutered here.
  const safeStem = (t: string) => stemOf(t).replace(/^\.+$/, '-');
  for (const siblings of byParent.values()) {
    const count = new Map<string, number>();
    for (const d of siblings) count.set(safeStem(d.title), (count.get(safeStem(d.title)) ?? 0) + 1);
    for (const d of siblings) {
      const stem = safeStem(d.title);
      stems.set(d.id, (count.get(stem) ?? 0) > 1 ? `${stem}-${d.id}` : stem);
    }
  }
  const byId = new Map(docs.map((d) => [d.id, d]));
  const folderOf = (id: number | null): string => {
    if (id === null) return '';
    const d = byId.get(id)!;
    return `${folderOf(parentOf(d))}${stems.get(id)}/`;
  };
  return new Map(docs.map((d) => [d.id, `${folderOf(parentOf(d))}${stems.get(d.id)}.md`]));
}

export function renderFrontmatter(
  fields: Record<string, string | number | boolean | null | string[]>,
): string {
  const lines = Object.entries(fields).map(([key, value]) => {
    const rendered =
      typeof value === 'string'
        ? JSON.stringify(value)
        : Array.isArray(value)
          ? `[${value.map((v) => JSON.stringify(v)).join(', ')}]`
          : String(value);
    return `${key}: ${rendered}`;
  });
  return `---\n${lines.join('\n')}\n---\n`;
}

export type Get = <T>(path: string) => Promise<T>;
export type Log = (message: string) => void;

export interface ProjectRow {
  id: number;
  teamId: number;
  teamName: string;
  key: string;
  name: string;
  description: string;
  documentsEnabled: boolean;
}
export interface DocFull extends DocSummary {
  content: string;
}
export interface MirrorState {
  version: 1;
  documents: Record<string, { version: number; path: string }>;
  projects: Record<string, { hash: string }>;
  skills: Record<string, { path: string; hash: string }>;
}
export interface MirrorReport {
  written: string[];
  deleted: string[];
  unchanged: number;
  warnings: string[];
}
export interface SyncContext {
  get: Get;
  root: string;
  archived: boolean;
  log: Log;
}

const STATE_PATH = '.itsaplan/state.json';

export async function loadState(root: string): Promise<MirrorState> {
  try {
    const parsed = JSON.parse(
      await readFile(join(root, STATE_PATH), 'utf8'),
    ) as Partial<MirrorState>;
    if (parsed.version === 1) {
      return {
        version: 1,
        documents: parsed.documents ?? {},
        projects: parsed.projects ?? {},
        skills: parsed.skills ?? {},
      };
    }
  } catch (err) {
    if (!(err instanceof SyntaxError) && (err as NodeJS.ErrnoException).code !== 'ENOENT')
      throw err;
  }
  return { version: 1, documents: {}, projects: {}, skills: {} };
}

export async function saveState(root: string, state: MirrorState): Promise<void> {
  // Written aside and renamed so a crash mid-write leaves the previous state readable
  // rather than a truncated file the next run has to discard.
  const path = join(root, STATE_PATH);
  await writeText(`${path}.tmp`, `${JSON.stringify(state, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Titles, project keys and state.json paths all reach the filesystem here; a document titled
// ".." plans "../" segments, so every write and delete is clamped to the mirror root.
function under(root: string, rel: string): string {
  const base = resolve(root);
  const full = resolve(base, rel);
  if (full !== base && !full.startsWith(base + sep)) {
    throw new Error(`refusing to touch a path outside the mirror: ${rel}`);
  }
  return full;
}

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex');
const withFinalNewline = (text: string) => text.replace(/\n*$/, '\n');

function renderDocument(project: ProjectRow, doc: DocFull): string {
  const head = renderFrontmatter({
    id: doc.id,
    project: project.key,
    title: doc.title,
    version: doc.version,
    updatedAt: doc.updatedAt,
    archived: doc.archivedAt !== null,
  });
  return `${head}\n${withFinalNewline(doc.content)}`;
}

function renderProject(project: ProjectRow): string {
  const head = renderFrontmatter({
    id: project.id,
    key: project.key,
    name: project.name,
    team: project.teamName,
    teamId: project.teamId,
  });
  return `${head}\n# ${project.name}\n\n${withFinalNewline(project.description)}`;
}

// Task 4 fills this in; the mirror already calls it so the sweep order stays fixed.
async function syncSkills(
  _ctx: SyncContext,
  _state: MirrorState,
  _report: MirrorReport,
  _projects: ProjectRow[],
): Promise<void> {}

// Writes `text` at `rel` unless the state already records the same version/hash and the file
// is still there; removes the previous file when the path moved. Shared by docs and skills.
async function place(
  ctx: SyncContext,
  report: MirrorReport,
  rel: string,
  text: string,
  known: { path: string } | undefined,
  unchanged: boolean,
): Promise<void> {
  if (known && unchanged && known.path === rel && (await exists(under(ctx.root, rel)))) {
    report.unchanged++;
    return;
  }
  if (known && known.path !== rel) {
    await rm(under(ctx.root, known.path), { force: true });
    report.deleted.push(known.path);
  }
  await writeText(under(ctx.root, rel), text);
  report.written.push(rel);
}

export async function syncOnce(ctx: SyncContext, state: MirrorState): Promise<MirrorReport> {
  const report: MirrorReport = { written: [], deleted: [], unchanged: 0, warnings: [] };
  const projects = await ctx.get<ProjectRow[]>('/projects');
  const seenDocs = new Set<string>();

  for (const project of projects) {
    const readme = `${project.key}/README.md`;
    const text = renderProject(project);
    const hash = hashOf(text);
    const knownProject = state.projects[project.id];
    await place(
      ctx,
      report,
      readme,
      text,
      knownProject ? { path: readme } : undefined,
      knownProject?.hash === hash,
    );
    state.projects[project.id] = { hash };

    const key = encodeURIComponent(project.key);
    const docs = [...(await ctx.get<DocSummary[]>(`/projects/${key}/documents`))];
    if (ctx.archived)
      docs.push(...(await ctx.get<DocSummary[]>(`/projects/${key}/documents?archived=true`)));
    const paths = planDocumentPaths(docs);
    for (const doc of docs) {
      const rel = `${project.key}/docs/${paths.get(doc.id)}`;
      seenDocs.add(String(doc.id));
      const known = state.documents[doc.id];
      if (
        known &&
        known.version === doc.version &&
        known.path === rel &&
        (await exists(under(ctx.root, rel)))
      ) {
        report.unchanged++;
        continue;
      }
      const full = await ctx.get<DocFull>(`/projects/${key}/documents/${doc.id}`);
      await place(ctx, report, rel, renderDocument(project, full), known, false);
      state.documents[doc.id] = { version: full.version, path: rel };
    }
  }

  await syncSkills(ctx, state, report, projects);

  for (const [id, known] of Object.entries(state.documents)) {
    if (seenDocs.has(id)) continue;
    await rm(under(ctx.root, known.path), { force: true });
    report.deleted.push(known.path);
    delete state.documents[id];
  }
  for (const warning of report.warnings) ctx.log(warning);
  return report;
}
