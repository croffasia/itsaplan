import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { LinkPreviewCache, linkPreviewMaxAge } from '../../cache';
import type { LinkPreview } from '../../metadata';

const START = new Date('2026-01-01T00:00:00Z').getTime();

function preview(url: URL, fields: Partial<LinkPreview> = {}): LinkPreview {
  return {
    url: url.href,
    title: 'Example',
    description: null,
    image: null,
    siteName: null,
    ...fields,
  };
}

describe('LinkPreviewCache', () => {
  beforeEach(() => setSystemTime(START));
  afterEach(() => setSystemTime());

  it('reuses metadata for five minutes without extending its lifetime on reads', async () => {
    const cache = new LinkPreviewCache();
    const url = new URL('https://example.com/article');
    let loads = 0;
    const load = async (url: URL) => preview(url, { title: `Version ${++loads}` });

    expect((await cache.get(url, load)).title).toBe('Version 1');
    setSystemTime(START + 299_999);
    expect((await cache.get(url, load)).title).toBe('Version 1');
    setSystemTime(START + 300_000);
    expect((await cache.get(url, load)).title).toBe('Version 2');
    expect(loads).toBe(2);
  });

  it('starts the lifetime when loading finishes', async () => {
    const cache = new LinkPreviewCache();
    const url = new URL('https://example.com/article');
    let finish!: (value: LinkPreview) => void;
    const response = new Promise<LinkPreview>((resolve) => {
      finish = resolve;
    });
    let loads = 0;
    const load = async () => {
      loads++;
      return response;
    };

    const pending = cache.get(url, load);
    setSystemTime(START + 4000);
    finish(preview(url));
    await pending;
    setSystemTime(START + 303_999);
    await cache.get(url, load);
    expect(loads).toBe(1);
    setSystemTime(START + 304_000);
    await cache.get(url, load);
    expect(loads).toBe(2);
  });

  it('retries empty or failed previews after fifteen seconds', async () => {
    const cache = new LinkPreviewCache();
    const url = new URL('https://example.com/article');
    let loads = 0;
    const load = async (url: URL) => {
      loads++;
      return preview(url, { title: null });
    };

    const empty = await cache.get(url, load);
    expect(linkPreviewMaxAge(empty)).toBe(15);
    setSystemTime(START + 14_999);
    await cache.get(url, load);
    expect(loads).toBe(1);
    setSystemTime(START + 15_000);
    await cache.get(url, load);
    expect(loads).toBe(2);
  });

  it('caches image-only, description-only and site-name-only metadata for five minutes', () => {
    const url = new URL('https://example.com/');
    for (const fields of [
      { image: 'data:image/png;base64,AA==' },
      { description: 'Description' },
      { siteName: 'Example' },
    ]) {
      expect(linkPreviewMaxAge(preview(url, { title: null, ...fields }))).toBe(300);
    }
  });

  it('normalizes URL serialization and fragments while retaining query order and values', async () => {
    const cache = new LinkPreviewCache();
    const loaded: string[] = [];
    const load = async (url: URL) => {
      loaded.push(url.href);
      return preview(url);
    };

    await cache.get(new URL('https://EXAMPLE.com:443/article?b=2&a=1#first'), load);
    await cache.get(new URL('https://example.com/article?b=2&a=1#second'), load);
    await cache.get(new URL('https://example.com/article?a=1&b=2'), load);
    await cache.get(new URL('https://example.com/article?b=3&a=1'), load);
    await cache.get(new URL('http://example.com/article?b=2&a=1'), load);

    expect(loaded).toEqual([
      'https://example.com/article?b=2&a=1',
      'https://example.com/article?a=1&b=2',
      'https://example.com/article?b=3&a=1',
      'http://example.com/article?b=2&a=1',
    ]);
  });

  it('shares a pending request across fragment variants', async () => {
    const cache = new LinkPreviewCache();
    const url = new URL('https://example.com/article');
    let finish!: (value: LinkPreview) => void;
    const response = new Promise<LinkPreview>((resolve) => {
      finish = resolve;
    });
    let loads = 0;
    const load = async () => {
      loads++;
      return response;
    };

    const first = cache.get(new URL(`${url.href}#first`), load);
    const second = cache.get(new URL(`${url.href}#second`), load);
    await Promise.resolve();
    expect(loads).toBe(1);
    finish(preview(url));
    expect(await Promise.all([first, second])).toEqual([preview(url), preview(url)]);
    await cache.get(url, load);
    expect(loads).toBe(1);
  });

  it('releases rejected pending requests so the next call can succeed', async () => {
    const cache = new LinkPreviewCache();
    const url = new URL('https://example.com/article');
    let reject!: (reason: Error) => void;
    const response = new Promise<LinkPreview>((_resolve, rejectResponse) => {
      reject = rejectResponse;
    });
    let loads = 0;
    const load = async () => {
      loads++;
      return response;
    };
    const pending = Promise.allSettled([cache.get(url, load), cache.get(url, load)]);
    await Promise.resolve();
    reject(new Error('Request failed'));

    expect((await pending).map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(loads).toBe(1);
    expect(await cache.get(url, async (url) => preview(url))).toEqual(preview(url));
  });

  it('also releases a loader that throws before returning a promise', async () => {
    const cache = new LinkPreviewCache();
    const url = new URL('https://example.com/article');
    await expect(
      cache.get(url, () => {
        throw new Error('Request failed');
      }),
    ).rejects.toThrow('Request failed');
    expect(await cache.get(url, async (url) => preview(url))).toEqual(preview(url));
  });

  it('evicts the least recently read preview at the 128-entry limit', async () => {
    const cache = new LinkPreviewCache();
    const loaded = new Map<string, number>();
    const load = async (url: URL) => {
      loaded.set(url.href, (loaded.get(url.href) ?? 0) + 1);
      return preview(url);
    };
    const url = (id: number) => new URL(`https://example.com/${id}`);

    for (let id = 0; id < 128; id++) await cache.get(url(id), load);
    await cache.get(url(0), load);
    await cache.get(url(128), load);
    await cache.get(url(0), load);
    await cache.get(url(1), load);

    expect(loaded.get(url(0).href)).toBe(1);
    expect(loaded.get(url(1).href)).toBe(2);
    expect(loaded.get(url(128).href)).toBe(1);
  });

  it('evicts image-heavy previews before exceeding the 16 MiB string budget', async () => {
    const cache = new LinkPreviewCache();
    const loaded: string[] = [];
    const load = async (url: URL) => {
      loaded.push(url.href);
      return preview(url, { image: `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}` });
    };
    const url = (id: number) => new URL(`https://example.com/${id}`);

    for (let id = 0; id < 4; id++) await cache.get(url(id), load);
    await cache.get(url(1), load);
    expect(loaded).toHaveLength(4);
    await cache.get(url(0), load);
    expect(loaded).toHaveLength(5);
    expect(loaded.at(-1)).toBe(url(0).href);
  });

  it('does not retain an oversized preview or evict useful entries for it', async () => {
    const cache = new LinkPreviewCache();
    const small = new URL('https://example.com/small');
    const large = new URL('https://example.com/large');
    const loaded: string[] = [];
    const load = async (url: URL) => {
      loaded.push(url.href);
      return preview(url, { image: url.href === large.href ? 'A'.repeat(8 * 1024 * 1024) : null });
    };

    await cache.get(small, load);
    await cache.get(large, load);
    await cache.get(large, load);
    await cache.get(small, load);
    expect(loaded).toEqual([small.href, large.href, large.href]);
  });
});
