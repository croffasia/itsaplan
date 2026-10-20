import { describe, it, expect } from 'bun:test';
import { ResponseTooLargeError, type PinnedRequestInit } from '@repo/net';
import {
  downloadAttachment,
  AttachmentRejectedError,
  type AttachmentFetch,
} from '../../attachment-download';

const FILE_URL = 'https://files.example.test/report.pdf';

function respondWith(response: Response): AttachmentFetch {
  return async () => response;
}

describe('downloadAttachment', () => {
  it('returns the body of a 2xx response', async () => {
    const bytes = await downloadAttachment(
      { url: FILE_URL },
      1024,
      respondWith(new Response('file bytes')),
    );
    expect(bytes.toString()).toBe('file bytes');
  });

  it.each([401, 403, 404, 500, 503])(
    'rejects an HTTP %d response instead of returning its body as the file',
    async (status) => {
      const error = await downloadAttachment(
        { url: FILE_URL },
        1024,
        respondWith(new Response('<Error>AccessDenied</Error>', { status })),
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AttachmentRejectedError);
      expect((error as Error).message).toContain(`HTTP ${status}`);
    },
  );

  it('rejects a redirect, which pinnedFetch returns without following', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: 'https://elsewhere.example.test/report.pdf' },
    });
    await expect(
      downloadAttachment({ url: FILE_URL }, 1024, respondWith(redirect)),
    ).rejects.toBeInstanceOf(AttachmentRejectedError);
  });

  it('rejects a file over the byte limit, which the source did not report a size for', async () => {
    const fetch: AttachmentFetch = async () => {
      throw new ResponseTooLargeError('response exceeds the byte limit');
    };
    const error = await downloadAttachment({ url: FILE_URL }, 1024, fetch).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AttachmentRejectedError);
    expect((error as Error).message).toContain('1024 bytes');
  });

  it('passes any other download failure through', async () => {
    const fetch: AttachmentFetch = async () => {
      throw new Error('request timed out');
    };
    const error = await downloadAttachment({ url: FILE_URL }, 1024, fetch).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(AttachmentRejectedError);
    expect((error as Error).message).toBe('request timed out');
  });

  it('downloads with the byte limit and a timeout', async () => {
    let seen: { url: string; init: PinnedRequestInit | undefined } | null = null;
    const fetch: AttachmentFetch = async (url, init) => {
      seen = { url, init };
      return new Response('x');
    };
    await downloadAttachment({ url: FILE_URL }, 2048, fetch);
    expect(seen!).toEqual({ url: FILE_URL, init: { timeoutMs: 30_000, maxBytes: 2048 } });
  });

  it('sends the headers the source asked for', async () => {
    let seen: PinnedRequestInit | undefined;
    const fetch: AttachmentFetch = async (_url, init) => {
      seen = init;
      return new Response('x');
    };
    await downloadAttachment(
      { url: FILE_URL, headers: { Authorization: 'source-token' } },
      2048,
      fetch,
    );
    expect(seen).toEqual({
      headers: { Authorization: 'source-token' },
      timeoutMs: 30_000,
      maxBytes: 2048,
    });
  });
});
