import { assertStrongSecret } from '@repo/crypto';

// Checked when the module loads, which is startup: a worker on an example token
// would only learn of it from the 401 of its first delivery.
const token = assertStrongSecret('WORKER_INTERNAL_TOKEN', process.env.WORKER_INTERNAL_TOKEN);

// Posts to the API's /internal/* routes. The worker owns the queues, the API owns
// the credentials and the actual send, so every outbound job goes through here.
// The api origin is SERVICE_URL_API in the compose stack (Coolify sets it) and
// API_URL locally.
export async function postInternal(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const baseUrl = process.env.SERVICE_URL_API ?? process.env.API_URL;
  if (!baseUrl) throw new Error('SERVICE_URL_API or API_URL is required');
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-worker-token': token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
