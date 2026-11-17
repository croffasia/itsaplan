import { keptApiKeySettings } from '#modules/settings/service';
import { HttpError } from './lib';

const WINDOW_MS = 60_000;

// One fixed window per API key, started by its first request. The windows are kept in
// this process, so with several api replicas a key gets the limit on each of them.
const windows = new Map<string, { start: number; count: number }>();

// Counts `requests` made with the key, or refuses them all with 429 when they would take
// the key past the instance's requests for this minute.
export async function countKeyRequests(keyId: string, requests = 1): Promise<void> {
  const { requestsPerMinute } = await keptApiKeySettings();
  if (requestsPerMinute === 0) return;
  const now = Date.now();
  let window = windows.get(keyId);
  if (!window || now - window.start >= WINDOW_MS) {
    window = { start: now, count: 0 };
    windows.set(keyId, window);
  }
  if (window.count + requests > requestsPerMinute) {
    const seconds = Math.ceil((window.start + WINDOW_MS - now) / 1000);
    throw new HttpError(
      429,
      `Too many requests with this API key. Try again in ${seconds} s.`,
      'RATE_LIMITED',
      { 'retry-after': String(seconds) },
    );
  }
  window.count += requests;
}
