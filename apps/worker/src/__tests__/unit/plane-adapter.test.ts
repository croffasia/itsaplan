import { describe, it, expect } from 'bun:test';
import {
  normalizeStateCategory,
  nextPageCursor,
  rateLimitBackoffMs,
  htmlToMarkdown,
} from '../../plane-adapter';

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

  it('returns an empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});
