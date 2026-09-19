import type { LinkPreview } from './metadata';

const MAX_ENTRIES = 128;
const MAX_BYTES = 16 * 1024 * 1024;

export function linkPreviewMaxAge(preview: LinkPreview): number {
  return preview.title || preview.description || preview.image || preview.siteName ? 300 : 15;
}

interface CacheEntry {
  preview: LinkPreview;
  expiresAt: number;
  bytes: number;
}

export class LinkPreviewCache {
  private entries = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<LinkPreview>>();
  private bytes = 0;

  async get(url: URL, load: (url: URL) => Promise<LinkPreview>): Promise<LinkPreview> {
    const normalized = new URL(url);
    normalized.hash = '';
    const key = normalized.href;
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry.preview;
    }
    if (entry) this.remove(key, entry);

    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= MAX_ENTRIES) return load(normalized);

    const request = Promise.resolve()
      .then(() => load(normalized))
      .then((preview) => {
        this.store(key, preview);
        return preview;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private store(key: string, preview: LinkPreview) {
    // Count UTF-16 storage conservatively, including the base64 image and both URLs.
    const bytes =
      2 *
      (key.length + Object.values(preview).reduce((size, value) => size + (value?.length ?? 0), 0));
    if (bytes > MAX_BYTES) return;

    const now = Date.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.remove(entryKey, entry);
    }
    for (const [entryKey, entry] of this.entries) {
      if (this.entries.size < MAX_ENTRIES && this.bytes + bytes <= MAX_BYTES) break;
      this.remove(entryKey, entry);
    }
    this.entries.set(key, { preview, expiresAt: now + linkPreviewMaxAge(preview) * 1000, bytes });
    this.bytes += bytes;
  }

  private remove(key: string, entry: CacheEntry) {
    this.entries.delete(key);
    this.bytes -= entry.bytes;
  }
}
