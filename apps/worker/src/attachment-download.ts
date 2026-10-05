import { pinnedFetch } from '@repo/net';
import type { AttachmentDownload } from './reader';

// An attachment that cannot be stored: over this instance's size, type or quota
// limits, or a download that did not return the file. The Attachments phase logs
// and skips it instead of failing the tick.
export class AttachmentRejectedError extends Error {}

export type AttachmentFetch = typeof pinnedFetch;

const DOWNLOAD_TIMEOUT_MS = 30_000;

// pinnedFetch returns any status as-is, a redirect included, so an error page
// must be refused here or it would be stored as the file.
export async function downloadAttachment(
  download: AttachmentDownload,
  maxBytes: number,
  fetch: AttachmentFetch = pinnedFetch,
): Promise<Buffer> {
  const res = await fetch(download.url, {
    headers: download.headers,
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    maxBytes,
  });
  if (!res.ok) {
    throw new AttachmentRejectedError(`the download answered HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
