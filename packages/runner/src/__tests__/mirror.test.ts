import { describe, it, expect } from 'bun:test';
import { Client, RequestError } from '../client';
import {
  parseMirrorArgs,
  stemOf,
  planDocumentPaths,
  renderFrontmatter,
  type DocSummary,
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
});

describe('renderFrontmatter', () => {
  it('quotes strings so titles with colons stay valid YAML, and lists arrays inline', () => {
    expect(
      renderFrontmatter({ id: 7, title: 'A: b "c"', archived: false, files: ['x/y.md'] }),
    ).toBe('---\nid: 7\ntitle: "A: b \\"c\\""\narchived: false\nfiles: ["x/y.md"]\n---\n');
  });
});
