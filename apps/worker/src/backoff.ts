// Equal-jitter exponential backoff. Half of the exponential window is fixed and
// half is random, so retries spread out (no thundering herd after an endpoint
// recovers) without collapsing to a near-zero delay on the first retry.
// `attempts` is 1-based: the number of the attempt that just failed.
export function equalJitterBackoffMs(
  attempts: number,
  baseMs = 60_000,
  capMs = 6 * 60 * 60_000,
): number {
  const window = Math.min(capMs, baseMs * 2 ** Math.max(0, attempts - 1));
  const half = window / 2;
  return Math.floor(half + Math.random() * half);
}
