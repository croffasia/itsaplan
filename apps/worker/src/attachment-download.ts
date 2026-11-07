import { pinnedFetch, ResponseTooLargeError } from '@repo/net';
import { SourceRateLimitedError, type AttachmentDownload } from './reader';

// An attachment that cannot be stored: over this instance's size, type or quota
// limits, or a download that did not return the file. The Attachments phase logs
// and skips it instead of failing the tick.
export class AttachmentRejectedError extends Error {}

export type AttachmentFetch = typeof pinnedFetch;

const DOWNLOAD_TIMEOUT_MS = 30_000;
const HOP_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

// A source that reports no size (Linear) is only caught by the byte limit itself.
async function fetchWithinLimit(
  download: AttachmentDownload,
  maxBytes: number,
  fetch: AttachmentFetch,
): Promise<Response> {
  try {
    return await fetch(download.url, {
      headers: download.headers,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      maxBytes,
    });
  } catch (error) {
    if (error instanceof ResponseTooLargeError) {
      throw new AttachmentRejectedError(`the file is larger than ${maxBytes} bytes`);
    }
    throw error;
  }
}

// pinnedFetch returns any status as-is, a redirect included, so an error page
// must be refused here or it would be stored as the file.
export async function downloadAttachment(
  download: AttachmentDownload,
  maxBytes: number,
  fetch: AttachmentFetch = pinnedFetch,
): Promise<Buffer> {
  const res = await fetchWithinLimit(download, maxBytes, fetch);
  if (!res.ok) {
    throw new AttachmentRejectedError(`the download answered HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export type DownloadHop =
  { kind: 'download' } | { kind: 'redirect'; url: string } | { kind: 'refused' };

// What one response from a source's file host means for resolveDownloadRedirects.
export function nextDownloadHop(
  source: string,
  currentUrl: string,
  status: number,
  location: string | null,
): DownloadHop {
  if (status >= 200 && status < 300) return { kind: 'download' };
  if (status < 300 || status >= 400) return { kind: 'refused' };
  if (!location) throw new AttachmentRejectedError(`${source} file storage redirected nowhere`);
  const next = new URL(location, currentUrl);
  if (next.protocol !== 'https:') {
    throw new AttachmentRejectedError(`${source} file storage redirected to a non-https URL`);
  }
  return { kind: 'redirect', url: next.toString() };
}

export interface DownloadRedirectOptions {
  // Names the source in the reasons a file is skipped.
  source: string;
  // The source's credential for a hop to its own file host, undefined for any other host.
  headersFor: (url: string) => Record<string, string> | undefined;
  rateLimitWaitMs: number;
}

// For a file host that needs the source's credential and may redirect to signed
// storage. pinnedFetch follows no redirect, so each hop is taken here, reading only
// the response head, and the credential goes only where headersFor gives it.
export async function resolveDownloadRedirects(
  url: string,
  options: DownloadRedirectOptions,
  fetch: AttachmentFetch = pinnedFetch,
): Promise<AttachmentDownload> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers = options.headersFor(current);
    const res = await fetch(current, {
      headers,
      timeoutMs: HOP_TIMEOUT_MS,
      maxBytes: 0,
      truncateBody: true,
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        options.rateLimitWaitMs,
        `${options.source} rate limit reached`,
      );
    }
    const next = nextDownloadHop(options.source, current, res.status, res.headers.get('location'));
    if (next.kind === 'download') return headers ? { url: current, headers } : { url: current };
    if (next.kind === 'refused') {
      throw new AttachmentRejectedError(
        `${options.source} file storage answered HTTP ${res.status}`,
      );
    }
    current = next.url;
  }
  throw new AttachmentRejectedError(
    `${options.source} file storage redirected more than ${MAX_REDIRECTS} times`,
  );
}

export function contentTypeForFilename(filename: string): string {
  return Bun.file(filename).type.split(';')[0]!;
}

// The Attachments phase reuses a file already on the issue under the same name, so
// three screenshots named "image.png" would otherwise become one.
export function uniqueFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf('.');
    let n = count;
    let candidate = '';
    do {
      candidate = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
      n++;
    } while (seen.has(candidate.toLowerCase()));
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}
