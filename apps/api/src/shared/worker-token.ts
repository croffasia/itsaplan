import { weakSecretReason } from '@repo/crypto';

// Whether a request to an /internal/* route carries the token the worker and the bot
// share. The env is read per request, so the tests can set it after the app is
// imported. src/index.ts refuses to start on a token that is unset, short or an
// example value; the same check here refuses the request when the app was started
// another way, so an example token never opens these routes.
export function workerTokenValid(headers: Record<string, string | undefined>): boolean {
  const expected = process.env.WORKER_INTERNAL_TOKEN;
  if (weakSecretReason(expected)) return false;
  return headers['x-worker-token'] === expected;
}
