import { timingSafeEqual } from 'node:crypto';

// Checks the x-worker-token header of an /internal/* request against
// WORKER_INTERNAL_TOKEN in constant time, so a wrong token cannot be recovered by
// timing the answer. Lengths are compared first because timingSafeEqual rejects
// buffers of different sizes. An instance without the token configured accepts
// nothing.
export function workerTokenValid(headers: Record<string, string | undefined>): boolean {
  const expected = process.env.WORKER_INTERNAL_TOKEN;
  const given = headers['x-worker-token'];
  if (!expected || given == null) return false;
  const expectedBytes = Buffer.from(expected);
  const givenBytes = Buffer.from(given);
  return expectedBytes.length === givenBytes.length && timingSafeEqual(expectedBytes, givenBytes);
}
