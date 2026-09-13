import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { resolveLinkPreview } from './resolveLinkPreview';

const origin = 'https://planner.test';
const scaffold = {
  project: { id: 1, key: 'SYR', name: 'Research', description: '**Project** overview' },
  columns: [{ id: 4, name: 'In progress', color: '#999999' }],
  issueTypes: [],
  labels: [],
  assignees: [],
  customFields: [],
};
let fetchOriginal: typeof fetch;
let calls: { url: URL; signal: AbortSignal | null | undefined }[];
let responses: Map<string, { status?: number; body: unknown }>;

beforeEach(() => {
  fetchOriginal = globalThis.fetch;
  calls = [];
  responses = new Map([['/projects/SYR', { body: scaffold }]]);
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, signal: init?.signal });
    const response = responses.get(url.pathname);
    return Response.json(response?.body ?? { error: 'Not found' }, {
      status: response?.status ?? (response ? 200 : 404),
    });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('authorized internal link previews', () => {
  it('reads project metadata through the authenticated endpoint', async () => {
    const signal = new AbortController().signal;
    const result = await resolveLinkPreview('/project/SYR?view=all#top', origin, signal);
    assert.equal(result.title, 'Research');
    assert.equal(result.description, 'Project overview');
    assert.equal(result.kind, 'project');
    assert.deepEqual(
      calls.map((call) => call.url.pathname),
      ['/projects/SYR'],
    );
    assert.equal(calls[0]!.signal, signal);
  });

  it('uses project sequence numbers and keeps legacy database IDs separate', async () => {
    const issue = {
      identifier: 'SYR-13',
      title: 'Check evidence',
      description: 'Read **sources**',
      columnId: 4,
      updatedAt: '2026-09-09T12:00:00Z',
    };
    responses.set('/projects/SYR/issues/13', { body: issue });
    responses.set('/issues/732', { body: issue });
    for (const path of ['/project/SYR/issue/13', '/SYR-13', '/issue/732']) {
      const result = await resolveLinkPreview(path, origin, new AbortController().signal);
      assert.equal(result.title, 'SYR-13 · Check evidence');
      assert.equal(result.status?.name, 'In progress');
      assert.equal(result.image, null);
    }
    assert.equal(calls.filter((call) => call.url.pathname === '/projects/SYR/issues/13').length, 2);
    assert.equal(calls.filter((call) => call.url.pathname === '/issues/732').length, 1);
  });

  it('reads document and bounded note board overviews', async () => {
    responses.set('/projects/SYR/documents/9', {
      body: { title: 'Plan', content: '# Outline\n\nNext step', updatedAt: '2026-09-09' },
    });
    responses.set('/projects/SYR/note-boards/18', {
      body: {
        name: 'Options',
        canvas: {
          nodes: Array.from({ length: 9 }, (_, id) => ({
            data: { title: `Note ${id}`, body: 'Some detail' },
          })),
        },
        updatedAt: '2026-09-09',
      },
    });
    const document = await resolveLinkPreview(
      '/project/SYR/docs/9',
      origin,
      new AbortController().signal,
    );
    assert.equal(document.description, 'Outline Next step');
    const notes = await resolveLinkPreview(
      '/project/SYR/notes/18',
      origin,
      new AbortController().signal,
    );
    assert.equal(notes.title, 'Options');
    assert.equal(notes.noteCount, 9);
    assert.match(notes.description!, /Note 2/);
    assert.doesNotMatch(notes.description!, /Note 3/);
  });

  it('resolves saved view names, layout and named filters', async () => {
    responses.set('/projects/SYR/views', {
      body: [
        {
          id: 41,
          name: 'Compare eight',
          display: { layout: 'table' },
          filters: { conditions: [{ field: 'status', op: 'is', values: [4] }] },
        },
      ],
    });
    const result = await resolveLinkPreview(
      '/project/SYR/view/41',
      origin,
      new AbortController().signal,
    );
    assert.equal(result.title, 'Compare eight');
    assert.equal(result.layout, 'table');
    assert.deepEqual(result.filters?.[0]?.values, ['In progress']);
    await assert.rejects(
      resolveLinkPreview('/project/SYR/view/43', origin, new AbortController().signal),
      { status: 404 },
    );
  });

  it('never falls back to public metadata for private, missing or unsupported internal pages', async () => {
    responses.set('/projects/SYR/note-boards/18', { status: 403, body: { error: 'Forbidden' } });
    await assert.rejects(
      resolveLinkPreview('/project/SYR/notes/18', origin, new AbortController().signal),
      { status: 403 },
    );
    await assert.rejects(
      resolveLinkPreview('/project/MISSING', origin, new AbortController().signal),
      { status: 404 },
    );
    const before = calls.length;
    for (const path of ['/account/profile', '/project/SYR/issue/0', '/project/%E0%A4%A']) {
      const result = await resolveLinkPreview(path, origin, new AbortController().signal);
      assert.equal(result.title, null);
    }
    assert.equal(calls.length, before);
    assert.ok(calls.every((call) => call.url.pathname !== '/link-previews'));
  });

  it('keeps foreign origins external even when their path matches a private route', async () => {
    responses.set('/link-previews', {
      body: { title: 'External', description: null, image: null, siteName: null },
    });
    const external = 'https://planner.test.example.com/project/SYR';
    await resolveLinkPreview(external, origin, new AbortController().signal);
    assert.equal(calls[0]!.url.pathname, '/link-previews');
    assert.equal(calls[0]!.url.searchParams.get('url'), external);
    assert.throws(
      () =>
        resolveLinkPreview(
          'https://user:password@planner.test/project/SYR',
          origin,
          new AbortController().signal,
        ),
      { status: 400 },
    );
  });
});
