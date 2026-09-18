import { describe, it, expect, beforeEach } from 'bun:test';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client, RequestError } from '../client';
import {
  parseMirrorArgs,
  stemOf,
  planDocumentPaths,
  renderFrontmatter,
  loadState,
  saveState,
  syncOnce,
  chunk,
  readDocumentRevs,
  commitIfChanged,
  watch,
  resolveEndpoint,
  type DocSummary,
  type Get,
} from '../mirror';

// The mirror reads everything over GET with the runner's key. If the client's GET stopped
// sending the key or stopped throwing on a non-2xx, the mirror would silently write nothing.

describe('Client.get', () => {
  it('sends the key and returns the parsed body', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), headers: (init?.headers as Record<string, string>) ?? {} });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    try {
      const client = new Client({ url: 'http://h', apiKey: 'k1' });
      await expect(client.get<{ ok: boolean }>('/projects')).resolves.toEqual({ ok: true });
      expect(seen[0]).toMatchObject({ url: 'http://h/projects', headers: { 'x-api-key': 'k1' } });
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('throws a RequestError carrying the status on a non-2xx answer', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response('nope', { status: 403 })) as typeof fetch;
    try {
      const client = new Client({ url: 'http://h', apiKey: 'k1' });
      await expect(client.get('/projects')).rejects.toBeInstanceOf(RequestError);
      await expect(client.get('/projects')).rejects.toMatchObject({ status: 403 });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

// Filenames and nesting are what a person greps; a wrong stem or a child written at the root
// would make a document unfindable without the mirror ever reporting an error.

describe('parseMirrorArgs', () => {
  it('applies the defaults and reads every flag in both forms', () => {
    expect(parseMirrorArgs([])).toMatchObject({
      out: './itsaplan-mirror',
      watch: false,
      intervalMs: 5000,
      git: false,
      archived: false,
      help: false,
    });
    expect(
      parseMirrorArgs([
        '--out',
        '/tmp/m',
        '--url=http://h',
        '--key',
        'k',
        '--watch',
        '--interval=1500',
        '--git',
        '--archived',
      ]),
    ).toMatchObject({
      out: '/tmp/m',
      url: 'http://h',
      key: 'k',
      watch: true,
      intervalMs: 1500,
      git: true,
      archived: true,
    });
  });
  it('refuses unknown options and a missing value, and floors the interval at a second', () => {
    expect(() => parseMirrorArgs(['--bogus'])).toThrow('unknown option --bogus');
    expect(() => parseMirrorArgs(['--out'])).toThrow('--out needs a value');
    expect(parseMirrorArgs(['--interval', '10']).intervalMs).toBe(1000);
  });
});

describe('stemOf', () => {
  it('matches the export filename rule: reserved and control characters become dashes, 120 chars, untitled fallback', () => {
    expect(stemOf('  Auth: flow/v2?  ')).toBe('Auth- flow-v2-');
    expect(stemOf('a' + String.fromCharCode(1) + 'b')).toBe('a-b');
    expect(stemOf('x'.repeat(200))).toHaveLength(120);
    expect(stemOf('   ')).toBe('untitled');
  });
});

const doc = (
  id: number,
  title: string,
  parentId: number | null = null,
  position = id,
): DocSummary => ({
  id,
  parentId,
  title,
  position,
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
});

describe('planDocumentPaths', () => {
  it('nests children under a folder named after the parent stem and keeps the parent file beside it', () => {
    const paths = planDocumentPaths([doc(1, 'Spec'), doc(2, 'Auth flow', 1), doc(3, 'Tokens', 2)]);
    expect(paths.get(1)).toBe('Spec.md');
    expect(paths.get(2)).toBe('Spec/Auth flow.md');
    expect(paths.get(3)).toBe('Spec/Auth flow/Tokens.md');
  });
  it('treats a child whose parent is not in the list as a root, since the API hides invisible parents', () => {
    expect(planDocumentPaths([doc(5, 'Orphan', 99)]).get(5)).toBe('Orphan.md');
  });
  it('suffixes the id on every sibling that shares a stem', () => {
    const paths = planDocumentPaths([doc(1, 'Notes'), doc(2, 'Notes'), doc(3, 'Other')]);
    expect(paths.get(1)).toBe('Notes-1.md');
    expect(paths.get(2)).toBe('Notes-2.md');
    expect(paths.get(3)).toBe('Other.md');
  });
  it('neuters a dot-only title so it can never become a traversal segment', () => {
    const paths = planDocumentPaths([doc(1, '..'), doc(2, 'Child', 1)]);
    expect(paths.get(1)).toBe('-.md');
    expect(paths.get(2)).toBe('-/Child.md');
  });
});

describe('renderFrontmatter', () => {
  it('quotes strings so titles with colons stay valid YAML, and lists arrays inline', () => {
    expect(
      renderFrontmatter({ id: 7, title: 'A: b "c"', archived: false, files: ['x/y.md'] }),
    ).toBe('---\nid: 7\ntitle: "A: b \\"c\\""\narchived: false\nfiles: ["x/y.md"]\n---\n');
  });
});

// A mirror that rewrites nothing on a change, or leaves a deleted page behind, is worse than
// no mirror: the agent reads stale text with full confidence.

interface FakeData {
  projects: unknown[];
  docs: Record<string, unknown[]>;
  bodies: Record<string, unknown>;
  revs?: Record<string, string>;
  skills?: Record<string, unknown[]>;
  markdown?: Record<string, string>;
}

function fakeApi(data: FakeData) {
  const calls: string[] = [];
  const fail = (status: number) =>
    Object.assign(new Error(`GET failed with ${status}`), { status });
  const get: Get = async <T>(path: string) => {
    calls.push(path);
    if (path === '/projects') return data.projects as T;
    const list = path.match(/^\/projects\/([^/]+)\/documents(\?archived=true)?$/);
    if (list) return ((list[2] ? data.docs[`${list[1]}:archived`] : data.docs[list[1]]) ?? []) as T;
    const one = path.match(/^\/projects\/([^/]+)\/documents\/(\d+)$/);
    if (one) return data.bodies[`${one[1]}:${one[2]}`] as T;
    if (path.startsWith('/sync/rev?')) return { revs: data.revs ?? {} } as T;
    const options = path.match(/^\/teams\/(\d+)\/agent-skills\/options$/);
    if (options) {
      if (!data.skills?.[options[1]]) throw fail(403);
      return data.skills[options[1]] as T;
    }
    const md = path.match(/^\/teams\/(\d+)\/agent-skills\/(\d+)\/markdown$/);
    if (md) return { markdown: data.markdown?.[`${md[1]}:${md[2]}`] ?? '' } as T;
    throw new Error(`unexpected ${path}`);
  };
  return { get, calls };
}

const project = {
  id: 1,
  teamId: 1,
  teamName: 'hody',
  key: 'HODY',
  name: 'Hody',
  description: 'Tracker',
  documentsEnabled: true,
};
const summary = (id: number, title: string, version = 1, parentId: number | null = null) => ({
  id,
  parentId,
  title,
  position: id,
  version,
  updatedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
});
const quiet = () => {};

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'itsaplan-mirror-'));
});

describe('syncOnce', () => {
  it('writes the description, every document in its folder, and the state', async () => {
    const api = fakeApi({
      projects: [project],
      docs: { HODY: [summary(1, 'Spec'), summary(2, 'Auth', 1, 1)] },
      bodies: {
        'HODY:1': { ...summary(1, 'Spec'), content: '# Spec' },
        'HODY:2': { ...summary(2, 'Auth', 1, 1), content: 'auth body\n\n' },
      },
    });
    const state = await loadState(root);
    const report = await syncOnce({ get: api.get, root, archived: false, log: quiet }, state);
    expect(report.written.sort()).toEqual([
      'HODY/README.md',
      'HODY/docs/Spec.md',
      'HODY/docs/Spec/Auth.md',
    ]);
    expect(await readFile(join(root, 'HODY/docs/Spec/Auth.md'), 'utf8')).toBe(
      '---\nid: 2\nproject: "HODY"\ntitle: "Auth"\nversion: 1\nupdatedAt: "2026-01-01T00:00:00.000Z"\narchived: false\n---\n\nauth body\n',
    );
    expect(await readFile(join(root, 'HODY/README.md'), 'utf8')).toContain('Tracker');
    await saveState(root, state);
    expect((await loadState(root)).documents['2']).toEqual({
      version: 1,
      path: 'HODY/docs/Spec/Auth.md',
    });
  });

  it('refetches only the document whose version moved, and removes the one that vanished', async () => {
    const first = fakeApi({
      projects: [project],
      docs: { HODY: [summary(1, 'Spec'), summary(2, 'Auth', 1, 1)] },
      bodies: {
        'HODY:1': { ...summary(1, 'Spec'), content: 'v1' },
        'HODY:2': { ...summary(2, 'Auth', 1, 1), content: 'a' },
      },
    });
    const state = await loadState(root);
    await syncOnce({ get: first.get, root, archived: false, log: quiet }, state);
    const second = fakeApi({
      projects: [project],
      docs: { HODY: [summary(1, 'Spec', 2)] },
      bodies: { 'HODY:1': { ...summary(1, 'Spec', 2), content: 'v2' } },
    });
    const report = await syncOnce({ get: second.get, root, archived: false, log: quiet }, state);
    expect(report.written).toEqual(['HODY/docs/Spec.md']);
    expect(report.deleted).toEqual(['HODY/docs/Spec/Auth.md']);
    expect(second.calls).not.toContain('/projects/HODY/documents/2');
    await expect(stat(join(root, 'HODY/docs/Spec/Auth.md'))).rejects.toThrow();
    expect(await readFile(join(root, 'HODY/docs/Spec.md'), 'utf8')).toContain('v2');
    expect(report.unchanged).toBe(1); // the README
  });

  it('rewrites a renamed document under its new name and drops the old file', async () => {
    const first = fakeApi({
      projects: [project],
      docs: { HODY: [summary(1, 'Old')] },
      bodies: { 'HODY:1': { ...summary(1, 'Old'), content: 'x' } },
    });
    const state = await loadState(root);
    await syncOnce({ get: first.get, root, archived: false, log: quiet }, state);
    const second = fakeApi({
      projects: [project],
      docs: { HODY: [summary(1, 'New', 2)] },
      bodies: { 'HODY:1': { ...summary(1, 'New', 2), content: 'x' } },
    });
    const report = await syncOnce({ get: second.get, root, archived: false, log: quiet }, state);
    expect(report.written).toEqual(['HODY/docs/New.md']);
    expect(report.deleted).toEqual(['HODY/docs/Old.md']);
  });

  it('includes the archive only when asked, marking those pages archived', async () => {
    const archived = { ...summary(9, 'Gone'), archivedAt: '2026-02-02T00:00:00.000Z' };
    const api = fakeApi({
      projects: [project],
      docs: { HODY: [], 'HODY:archived': [archived] },
      bodies: { 'HODY:9': { ...archived, content: 'old' } },
    });
    const state = await loadState(root);
    const none = await syncOnce({ get: api.get, root, archived: false, log: quiet }, state);
    expect(none.written).toEqual(['HODY/README.md']);
    const withArchive = await syncOnce({ get: api.get, root, archived: true, log: quiet }, state);
    expect(withArchive.written).toEqual(['HODY/docs/Gone.md']);
    expect(await readFile(join(root, 'HODY/docs/Gone.md'), 'utf8')).toContain('archived: true');
  });

  it('refuses to delete a state path that points outside the mirror', async () => {
    const api = fakeApi({ projects: [project], docs: { HODY: [] }, bodies: {} });
    const state = await loadState(root);
    state.documents['9'] = { version: 1, path: '../../evil.md' };
    await expect(
      syncOnce({ get: api.get, root, archived: false, log: quiet }, state),
    ).rejects.toThrow(/outside the mirror/);
  });

  it('starts from an empty state when state.json is corrupt', async () => {
    await mkdir(join(root, '.itsaplan'), { recursive: true });
    await writeFile(join(root, '.itsaplan/state.json'), 'not json {');
    expect(await loadState(root)).toEqual({ version: 1, documents: {}, projects: {}, skills: {} });
  });
});

describe('skills', () => {
  it('mirrors each skill of every team the projects belong to, once', async () => {
    const api = fakeApi({
      projects: [project],
      docs: { HODY: [] },
      bodies: {},
      skills: {
        '1': [
          {
            id: 4,
            teamId: 1,
            name: 'Review PR',
            description: 'd',
            source: 'inline',
            sourceUrl: null,
            files: [{ path: 'refs/a.md' }],
          },
        ],
      },
      markdown: { '1:4': '# Review\n' },
    });
    const state = await loadState(root);
    const report = await syncOnce({ get: api.get, root, archived: false, log: quiet }, state);
    expect(report.written).toContain('teams/hody/skills/Review PR.md');
    expect(await readFile(join(root, 'teams/hody/skills/Review PR.md'), 'utf8')).toBe(
      '---\nid: 4\nteam: "hody"\nteamId: 1\nname: "Review PR"\ndescription: "d"\nsource: "inline"\nsourceUrl: null\nfiles: ["refs/a.md"]\n---\n\n# Review\n',
    );
    const again = await syncOnce({ get: api.get, root, archived: false, log: quiet }, state);
    expect(again.written).toEqual([]);

    const dotTeam = fakeApi({
      projects: [{ ...project, teamName: '..' }],
      docs: { HODY: [] },
      bodies: {},
      skills: {
        '1': [
          {
            id: 4,
            teamId: 1,
            name: 'Review PR',
            description: 'd',
            source: 'inline',
            sourceUrl: null,
            files: [{ path: 'refs/a.md' }],
          },
        ],
      },
      markdown: { '1:4': '# Review\n' },
    });
    const renamed = await syncOnce({ get: dotTeam.get, root, archived: false, log: quiet }, state);
    expect(renamed.written).toContain('teams/-/skills/Review PR.md');
  });

  it("warns once and keeps mirroring documents when the key may not read a team's skills", async () => {
    const api = fakeApi({
      projects: [project],
      docs: { HODY: [summary(1, 'Spec')] },
      bodies: { 'HODY:1': { ...summary(1, 'Spec'), content: 'x' } },
    });
    const logged: string[] = [];
    const report = await syncOnce(
      { get: api.get, root, archived: false, log: (m) => logged.push(m) },
      await loadState(root),
    );
    expect(report.written).toContain('HODY/docs/Spec.md');
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toMatch(/skills of team hody .*403/);
    expect(logged).toEqual(report.warnings);
  });
});

const run = promisify(execFile);

// The rev endpoint refuses more than 20 scopes in one request, and a mirror that never
// commits (or commits an empty pass) would give git history nobody can trust.

describe('watch plumbing', () => {
  it('splits scopes into requests of at most 20 and merges the answers', async () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    const paths: string[] = [];
    const get: Get = async <T>(path: string) => {
      paths.push(path);
      const scopes = decodeURIComponent(path.slice('/sync/rev?scopes='.length)).split(',');
      return { revs: Object.fromEntries(scopes.map((s) => [s, '1'])) } as T;
    };
    const revs = await readDocumentRevs(
      get,
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
    expect(paths).toHaveLength(2);
    expect(Object.keys(revs)).toHaveLength(25);
    expect(revs['documents:25']).toBe('1');
  });

  it('commits a pass that wrote something and skips one that did not', async () => {
    await writeFile(join(root, 'a.md'), 'x');
    const wrote = { written: ['a.md'], deleted: [], unchanged: 0, warnings: [] };
    expect(await commitIfChanged(root, wrote, new Date('2026-01-02T03:04:05Z'))).toBe(true);
    const { stdout } = await run('git', ['-C', root, 'log', '--format=%s']);
    expect(stdout.trim()).toBe('mirror: 2026-01-02T03:04:05.000Z');
    const idle = { written: [], deleted: [], unchanged: 3, warnings: [] };
    expect(await commitIfChanged(root, idle, new Date())).toBe(false);
  });

  it('returns false instead of throwing when git has nothing left to commit', async () => {
    await writeFile(join(root, 'a.md'), 'x');
    const wrote = { written: ['a.md'], deleted: [], unchanged: 0, warnings: [] };
    expect(await commitIfChanged(root, wrote, new Date('2026-01-02T03:04:05Z'))).toBe(true);
    expect(await commitIfChanged(root, wrote, new Date())).toBe(false);
  });

  it('refuses to commit when the mirror root sits inside a foreign git repo', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'itsaplan-foreign-repo-'));
    await run('git', ['-C', repoRoot, 'init', '-q']);
    const subdir = join(repoRoot, 'mirror');
    await mkdir(subdir, { recursive: true });
    await writeFile(join(subdir, 'a.md'), 'x');
    const before = (await run('git', ['-C', repoRoot, 'status', '--short'])).stdout;
    const wrote = { written: ['a.md'], deleted: [], unchanged: 0, warnings: [] };
    await expect(commitIfChanged(subdir, wrote, new Date())).rejects.toThrow(/inside the git repo/);
    const after = (await run('git', ['-C', repoRoot, 'status', '--short'])).stdout;
    expect(after).toBe(before);
  });

  it('runs a pass when a document marker moves and otherwise only polls', async () => {
    let rev = 'a';
    let passes = 0;
    const get: Get = async <T>(path: string) => {
      if (path === '/projects') {
        passes++;
        return [project] as T;
      }
      if (path.startsWith('/projects/')) return [] as T;
      if (path.startsWith('/sync/rev')) return { revs: { 'documents:1': rev } } as T;
      throw Object.assign(new Error('403'), { status: 403 });
    };
    let ticks = 0;
    await watch({
      get,
      root,
      archived: false,
      log: quiet,
      intervalMs: 1000,
      git: false,
      stopping: () => ticks >= 3,
      sleep: async () => {
        ticks++;
        if (ticks === 2) rev = 'b';
      },
    });
    // /projects is read twice per pass (sync + id refresh): the initial pass and the one the
    // real marker move triggers.
    expect(passes).toBe(4);
  });
});

describe('resolveEndpoint', () => {
  it('prefers the flag, then the environment, then the config file, and strips trailing slashes', async () => {
    const file = join(root, 'itsaplan-runner.json');
    await writeFile(
      file,
      JSON.stringify({ url: 'http://file/', apiKey: 'k-file', agent: 'claude' }),
    );
    const args = parseMirrorArgs(['--config', file]);
    expect(await resolveEndpoint(args, {})).toEqual({ url: 'http://file', apiKey: 'k-file' });
    expect(await resolveEndpoint(args, { ITSAPLAN_URL: 'http://env' })).toEqual({
      url: 'http://env',
      apiKey: 'k-file',
    });
    expect(
      await resolveEndpoint(
        { ...args, url: 'http://flag/', key: 'k-flag' },
        { ITSAPLAN_URL: 'http://env' },
      ),
    ).toEqual({
      url: 'http://flag',
      apiKey: 'k-flag',
    });
  });
  it('takes the first key of a multi-agent config and refuses a config without one', async () => {
    const multi = join(root, 'multi.json');
    await writeFile(
      multi,
      JSON.stringify({ url: 'http://h', agents: [{ apiKey: 'k-a' }, { apiKey: 'k-b' }] }),
    );
    expect((await resolveEndpoint(parseMirrorArgs(['--config', multi]), {})).apiKey).toBe('k-a');
    const none = join(root, 'none.json');
    await writeFile(none, JSON.stringify({ url: 'http://h' }));
    await expect(resolveEndpoint(parseMirrorArgs(['--config', none]), {})).rejects.toThrow(
      'apiKey',
    );
  });
});
