// Posts to the API's /internal/* routes. The worker owns the queues, the API owns
// the credentials and the actual send, so every outbound job goes through here.
// The routes are served on the api's internal listener, not on its public origin.
export async function postInternal(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const token = process.env.WORKER_INTERNAL_TOKEN;
  if (!token) throw new Error('WORKER_INTERNAL_TOKEN is required');
  return fetch(`${internalApiUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-worker-token': token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// The internal listener's origin: SERVICE_URL_API_INTERNAL where the stack sets it
// (the compose files and the chart do). Otherwise the host of the api origin
// (SERVICE_URL_API, else API_URL) on INTERNAL_PORT, which is what local dev runs:
// api and worker on the same machine, the api's second listener on 3002.
export function internalApiUrl(): string {
  const configured = process.env.SERVICE_URL_API_INTERNAL;
  if (configured) return configured.replace(/\/+$/, '');
  const origin = process.env.SERVICE_URL_API ?? process.env.API_URL;
  if (!origin) throw new Error('SERVICE_URL_API_INTERNAL, SERVICE_URL_API or API_URL is required');
  return `http://${new URL(origin).hostname}:${process.env.INTERNAL_PORT ?? 3002}`;
}
