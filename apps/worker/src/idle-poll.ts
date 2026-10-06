// Delay after consecutive empty polls. emptyStreak 0 is the first empty wait (baseMs);
// each further empty doubles the delay up to capMs.
//
// Copied next to each consumer (api, worker, runner) rather than a shared package:
// eight lines do not justify a workspace member and the Dockerfile COPY list it pulls
// in, and the runner's published bundle cannot depend on a private @repo package.
// Revisit if a fourth copy appears, or if equalJitterBackoffMs (also duplicated in api
// and worker) is extracted with it.
export function nextIdlePollMs(emptyStreak: number, baseMs: number, capMs: number): number {
  const base = Math.max(1, baseMs);
  const cap = Math.max(base, capMs);
  const exp = Math.min(Math.max(0, emptyStreak), 20);
  return Math.min(cap, base * 2 ** exp);
}

export function idlePollDebug(label: string, delayMs: number, emptyStreak: number): void {
  if (process.env.IDLE_POLL_DEBUG === '1') {
    console.log(`[${label}] idle ${delayMs}ms (streak ${emptyStreak})`);
  }
}
