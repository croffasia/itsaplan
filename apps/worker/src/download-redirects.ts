import type { pinnedFetch } from '@repo/net';
import { AttachmentRejectedError } from './attachment-download';
import { SourceRateLimitedError, type AttachmentDownload } from './reader';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

// pinnedFetch follows no redirect and downloadAttachment refuses anything but 2xx,
// so a file host that redirects to signed storage is walked here, reading only the
// response head. headersFor decides per URL whether the source credential is sent,
// so it never reaches the storage host a redirect points at.
export async function resolveRedirects(
  fetch: typeof pinnedFetch,
  startUrl: string,
  headersFor: (url: string) => Record<string, string> | undefined,
  source: string,
): Promise<AttachmentDownload> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers = headersFor(url);
    const res = await fetch(url, {
      headers,
      timeoutMs: TIMEOUT_MS,
      maxBytes: 0,
      truncateBody: true,
    });
    if (res.status === 429)
      throw new SourceRateLimitedError(60_000, `${source} rate limit reached`);
    if (res.status >= 200 && res.status < 300) return headers ? { url, headers } : { url };
    if (res.status < 300 || res.status >= 400) {
      throw new AttachmentRejectedError(`${source} file storage answered HTTP ${res.status}`);
    }
    const location = res.headers.get('location');
    if (!location) throw new AttachmentRejectedError(`${source} file storage redirected nowhere`);
    const next = new URL(location, url);
    if (next.protocol !== 'https:') {
      throw new AttachmentRejectedError(`${source} file storage redirected to a non-https URL`);
    }
    url = next.toString();
  }
  throw new AttachmentRejectedError(
    `${source} file storage redirected more than ${MAX_REDIRECTS} times`,
  );
}

// Retry-After in seconds, or the fallback when absent; capped at an hour.
export function retryAfterMs(headers: Headers, fallbackMs: number): number {
  const seconds = Number(headers.get('retry-after'));
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackMs;
  return Math.min(3_600_000, Math.max(1000, seconds * 1000));
}
