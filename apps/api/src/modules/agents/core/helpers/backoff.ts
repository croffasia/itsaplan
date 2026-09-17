// Equal-jitter exponential backoff. Half of the exponential window is fixed and half
// is random, so retries spread out instead of all coming back at the same moment.
// `attempts` is 1-based: the number of the attempt that just failed.
export function equalJitterBackoffMs(attempts: number, baseMs: number, capMs: number): number {
  const window = Math.min(capMs, baseMs * 2 ** Math.max(0, attempts - 1));
  const half = window / 2;
  return Math.floor(half + Math.random() * half);
}
