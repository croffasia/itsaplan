import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ResponseTooLargeError, UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(
  async (_url: string, _init?: { publicOnly?: boolean }): Promise<Response> => new Response(),
);
mock.module('@repo/net', () => ({ pinnedFetch, ResponseTooLargeError, UrlNotAllowedError }));

const { part, pdfRead, search } = await import('../read');

const fixture = (name: string) => Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).bytes();

describe('pdf_read', () => {
  beforeEach(() => pinnedFetch.mockReset());

  it('returns the text of a PDF fetched through the public-only guard', async () => {
    const bytes = await fixture('text.pdf');
    pinnedFetch.mockImplementation(async () => new Response(bytes));
    const result = (await pdfRead.execute({}, { url: 'https://example.com/notes.pdf' })) as {
      markdown: string;
      pageCount: number;
    };
    expect(result.markdown).toContain('# Release Notes');
    expect(result.pageCount).toBeGreaterThan(0);
    expect(pinnedFetch.mock.calls[0]![1]).toMatchObject({ publicOnly: true });
  });

  it('splits a long text into parts at line breaks', () => {
    expect(part('short', 0)).toEqual({ markdown: 'short', nextOffset: null });

    const long = 'x'.repeat(59_000) + '\n' + 'y'.repeat(2_000);
    const first = part(long, 0);
    expect(first).toEqual({ markdown: 'x'.repeat(59_000), nextOffset: 59_000 });
    expect(part(long, first.nextOffset!)).toEqual({
      markdown: '\n' + 'y'.repeat(2_000),
      nextOffset: null,
    });

    expect(part('z'.repeat(70_000), 0).markdown).toHaveLength(60_000);
  });

  it('returns the passages around each match of a query', () => {
    const pad = (n: number) => '.'.repeat(n);
    const text = `${pad(1_500)}Total Price${pad(3_000)}total\n price${pad(100)}`;
    expect(search(text, 'total price', 0)).toEqual({
      passages: [
        { offset: 500, text: `${pad(1_000)}Total Price${pad(1_000)}` },
        { offset: 3_511, text: `${pad(1_000)}total\n price${pad(100)}` },
      ],
      nextOffset: null,
    });
    expect(search(text, 'missing', 0)).toEqual({ passages: [], nextOffset: null });
    // A match inside the previous passage does not open a passage of its own.
    expect(search('a.b.a', 'a', 0).passages).toEqual([{ offset: 0, text: 'a.b.a' }]);
    // Regex characters in the query are matched as text.
    expect(search('cost (net): 5', 'cost (net)', 0).passages).toHaveLength(1);
  });

  it('stops the passages at the bound and continues the search from nextOffset', () => {
    const text = Array.from({ length: 40 }, (_, i) => `${'.'.repeat(2_000)}hit${i}`).join('');
    const first = search(text, 'hit', 0);
    expect(first.passages.length).toBeLessThan(40);
    expect(first.passages.reduce((sum, p) => sum + p.text.length, 0)).toBeLessThanOrEqual(60_000);
    const rest = search(text, 'hit', first.nextOffset!);
    expect(rest.nextOffset).toBeNull();
    expect(first.passages.length + rest.passages.length).toBe(40);
  });

  it('searches the parsed text of a fetched PDF', async () => {
    const bytes = await fixture('text.pdf');
    pinnedFetch.mockImplementation(async () => new Response(bytes));
    const result = (await pdfRead.execute(
      {},
      { url: 'https://example.com/notes.pdf', query: 'release notes' },
    )) as { passages: { text: string }[]; markdown?: string };
    expect(result.passages[0]!.text).toContain('# Release Notes');
    expect(result.markdown).toBeUndefined();
  });

  it('follows a redirect through the guard again', async () => {
    const bytes = await fixture('text.pdf');
    pinnedFetch.mockImplementationOnce(
      async () => new Response(null, { status: 302, headers: { location: '/files/notes.pdf' } }),
    );
    pinnedFetch.mockImplementationOnce(async () => new Response(bytes));
    await pdfRead.execute({}, { url: 'https://example.com/latest' });
    expect(pinnedFetch.mock.calls.map(([url]) => url)).toEqual([
      'https://example.com/latest',
      'https://example.com/files/notes.pdf',
    ]);
  });

  it('refuses a scanned PDF', async () => {
    const bytes = await fixture('scanned.pdf');
    pinnedFetch.mockImplementation(async () => new Response(bytes));
    await expect(pdfRead.execute({}, { url: 'https://example.com/scan.pdf' })).rejects.toThrow(
      'no text layer',
    );
  });

  it('reports an address the guard refuses', async () => {
    pinnedFetch.mockImplementation(async () => {
      throw new UrlNotAllowedError('url must not point to a private or local address');
    });
    await expect(pdfRead.execute({}, { url: 'http://10.0.0.1/a.pdf' })).rejects.toThrow(
      'private or local address',
    );
  });
});
