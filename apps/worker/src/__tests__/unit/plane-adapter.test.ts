import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import {
  PlaneReader,
  normalizeStateCategory,
  nextPageCursor,
  rateLimitBackoffMs,
  htmlToMarkdown,
} from '../../plane-adapter';
import { SourceRateLimitedError } from '../../reader';

describe('normalizeStateCategory', () => {
  it("maps the British-spelled cancelled to itsaplan's canceled", () => {
    expect(normalizeStateCategory('cancelled')).toBe('canceled');
  });

  it('falls back triage to backlog, which itsaplan has no equivalent for', () => {
    expect(normalizeStateCategory('triage')).toBe('backlog');
  });

  it('passes the shared categories through unchanged', () => {
    expect(normalizeStateCategory('backlog')).toBe('backlog');
    expect(normalizeStateCategory('unstarted')).toBe('unstarted');
    expect(normalizeStateCategory('started')).toBe('started');
    expect(normalizeStateCategory('completed')).toBe('completed');
  });

  it('falls back an unknown group to backlog rather than throwing', () => {
    expect(normalizeStateCategory('something-new')).toBe('backlog');
  });
});

describe('nextPageCursor', () => {
  it('returns null once next_page_results is false, regardless of the cursor string', () => {
    expect(nextPageCursor('100:4:300', false)).toBeNull();
  });

  it('returns the exact next_cursor string when another page remains', () => {
    expect(nextPageCursor('100:3:200', true)).toBe('100:3:200');
  });

  it('returns null on the first page with no results at all', () => {
    expect(nextPageCursor(null, false)).toBeNull();
  });
});

describe('rateLimitBackoffMs', () => {
  it('honors Retry-After over everything else', () => {
    const ms = rateLimitBackoffMs({
      status: 429,
      remaining: '5',
      resetEpochSec: null,
      retryAfterSec: '30',
    });
    expect(ms).toBe(30_000);
  });

  it('falls back to a minute on a 429 with no Retry-After', () => {
    const ms = rateLimitBackoffMs({
      status: 429,
      remaining: '5',
      resetEpochSec: null,
      retryAfterSec: null,
    });
    expect(ms).toBe(60_000);
  });

  it('backs off until x-ratelimit-reset when remaining hits zero', () => {
    const nowMs = 1_000_000;
    const resetEpochSec = String(nowMs / 1000 + 45);
    const ms = rateLimitBackoffMs(
      { status: 200, remaining: '0', resetEpochSec, retryAfterSec: null },
      nowMs,
    );
    expect(ms).toBe(45_000);
  });

  it('does not back off on a normal response with remaining hits left', () => {
    const ms = rateLimitBackoffMs({
      status: 200,
      remaining: '59',
      resetEpochSec: null,
      retryAfterSec: null,
    });
    expect(ms).toBeNull();
  });
});

describe('htmlToMarkdown', () => {
  it('converts a paragraph', () => {
    expect(htmlToMarkdown('<p>Hello world</p>')).toBe('Hello world');
  });

  it('converts bold, italic and inline code', () => {
    expect(htmlToMarkdown('<p><strong>bold</strong> <em>italic</em> <code>x = 1</code></p>')).toBe(
      '**bold** *italic* `x = 1`',
    );
  });

  it('converts a fenced code block without mangling its contents', () => {
    const html = '<pre><code>const x = 1;\nconst y = 2;</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```\nconst x = 1;\nconst y = 2;\n```');
  });

  it('converts a link', () => {
    expect(htmlToMarkdown('<p><a href="https://example.com">example</a></p>')).toBe(
      '[example](https://example.com)',
    );
  });

  it('converts an unordered list', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two');
  });

  it('converts a Tiptap task list using data-checked', () => {
    const html =
      '<ul data-type="taskList"><li data-checked="true">done</li><li data-checked="false">todo</li></ul>';
    expect(htmlToMarkdown(html)).toBe('- [x] done\n- [ ] todo');
  });

  it('converts a heading', () => {
    expect(htmlToMarkdown('<h2>Section</h2>')).toBe('## Section');
  });

  it('decodes HTML entities', () => {
    expect(htmlToMarkdown('<p>Tom &amp; Jerry, a &quot;classic&quot;&nbsp;show</p>')).toBe(
      'Tom & Jerry, a "classic" show',
    );
  });

  it('strips nested tag fragments', () => {
    expect(htmlToMarkdown('<p><scr<script>ipt>x</p>')).not.toMatch(/<script/i);
  });

  it('decodes entities once', () => {
    expect(htmlToMarkdown('<p>&amp;lt;b&amp;gt;</p>')).toBe('&lt;b&gt;');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

function readerAnswering(response: Response, sent: SentRequest[] = []): PlaneReader {
  const credential = {
    baseUrl: 'https://plane.example.test/',
    workspaceSlug: 'acme',
    apiKey: 'plane-api-key',
  };
  return new PlaneReader(credential, 'project-1', async (url, init) => {
    sent.push({ url, init });
    return response;
  });
}

describe('PlaneReader', () => {
  it('sends the API key to the project-scoped Plane endpoint', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      Response.json({ results: [], next_cursor: null, next_page_results: false }),
      sent,
    );
    expect(await reader.listStates()).toEqual([]);
    expect(sent).toEqual([
      {
        url: 'https://plane.example.test/api/v1/workspaces/acme/projects/project-1/states/',
        init: { headers: { 'X-Api-Key': 'plane-api-key' }, timeoutMs: 15_000 },
      },
    ]);
  });

  it('throws the source-neutral rate-limit error on a 429', async () => {
    const reader = readerAnswering(
      new Response('', { status: 429, headers: { 'retry-after': '30' } }),
    );
    const error = await reader.listStates().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceRateLimitedError);
    expect((error as SourceRateLimitedError).retryAfterMs).toBe(30_000);
    expect((error as Error).message).toBe('Plane rate limit reached');
  });

  it('throws it when the remaining budget reaches zero on a 200', async () => {
    const reader = readerAnswering(
      Response.json(
        { results: [], next_cursor: null, next_page_results: false },
        { headers: { 'x-ratelimit-remaining': '0' } },
      ),
    );
    await expect(reader.listStates()).rejects.toBeInstanceOf(SourceRateLimitedError);
  });

  it('resolves an attachment to the redirect target, with no Plane credential attached', async () => {
    const sent: SentRequest[] = [];
    const target = 'https://s3.example.test/bucket/report.pdf?X-Amz-Signature=abc';
    const reader = readerAnswering(
      new Response(null, { status: 302, headers: { location: target } }),
      sent,
    );
    expect(await reader.resolveAttachmentDownload('issue-1', 'att-1')).toStrictEqual({
      url: target,
    });
    expect(sent[0]!.url).toBe(
      'https://plane.example.test/api/v1/workspaces/acme/projects/project-1/work-items/issue-1/attachments/att-1/',
    );
  });

  it('refuses an attachment resolve that did not redirect', async () => {
    const reader = readerAnswering(new Response('{}', { status: 200 }));
    await expect(reader.resolveAttachmentDownload('issue-1', 'att-1')).rejects.toThrow(
      'Plane attachment resolve did not redirect: GET /work-items/issue-1/attachments/att-1/ -> HTTP 200',
    );
  });
});
