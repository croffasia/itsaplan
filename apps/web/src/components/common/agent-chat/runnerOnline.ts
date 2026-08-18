// A runner is considered online while it keeps polling; the reference runner polls
// every few seconds, so a gap this long means it is gone rather than between polls.
const ONLINE_WINDOW_MS = 90_000;

// Only an external agent has a runner; an internal one runs on the instance itself.
export function isRunnerOnline(agent: { lastSeenAt: string | null } | null): boolean {
  const lastSeen = agent?.lastSeenAt ?? null;
  return lastSeen != null && Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}
