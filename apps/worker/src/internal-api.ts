// Posts to the API's /internal/* routes. The worker owns the queues, the API owns
// the credentials and the actual send, so every outbound job goes through here.
// The api origin is SERVICE_URL_API in the compose stack (Coolify sets it) and
// API_URL locally.
export async function postInternal(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const token = process.env.WORKER_INTERNAL_TOKEN;
  if (!token) throw new Error('WORKER_INTERNAL_TOKEN is required');
  const baseUrl = process.env.SERVICE_URL_API ?? process.env.API_URL;
  if (!baseUrl) throw new Error('SERVICE_URL_API or API_URL is required');
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-worker-token': token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
