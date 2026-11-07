import { serverRuntimeEnv } from '@/utils/runtimeEnv';

// The sites the instance owner lets show the public pages in a frame (`GET /embed-sites`),
// read by the proxy at most once a minute. While the api does not answer, the last list
// stands; before the first answer it is empty, so no site frames anything.
const TTL_MS = 60_000;
const TIMEOUT_MS = 2_000;

let read: { at: number; origins: Promise<string[]> } = { at: 0, origins: Promise.resolve([]) };

// Reached as the /media routes reach the api: by its address inside the deployment's network
// when SERVICE_URL_API names one.
async function fetchEmbedSites(): Promise<string[]> {
  const origin = process.env.SERVICE_URL_API || serverRuntimeEnv().apiUrl;
  const res = await fetch(`${origin}/embed-sites`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`embed sites: ${res.status}`);
  return ((await res.json()) as { origins: string[] }).origins;
}

export function readEmbedSites(): Promise<string[]> {
  if (Date.now() - read.at >= TTL_MS) {
    const last = read.origins;
    read = { at: Date.now(), origins: fetchEmbedSites().catch(() => last) };
  }
  return read.origins;
}

// Drops what was read, so the next page reads the list again.
export function forgetEmbedSites(): void {
  read = { at: 0, origins: Promise.resolve([]) };
}
