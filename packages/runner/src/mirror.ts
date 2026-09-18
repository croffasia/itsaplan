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
  for (const siblings of byParent.values()) {
    const count = new Map<string, number>();
    for (const d of siblings) count.set(stemOf(d.title), (count.get(stemOf(d.title)) ?? 0) + 1);
    for (const d of siblings) {
      const stem = stemOf(d.title);
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
