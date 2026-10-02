// Startup checks for env pairs that would re-claim work still in flight. Defaults are
// safe; these catch an operator who shortens a lease without raising the matching
// timeout (or below the external runner's heartbeat).

import { intEnv } from '#shared/lib';

// packages/runner heartbeats every 60s (HEARTBEAT_MS in packages/runner/src/cli.ts).
// A lease at or below that is re-claimed before the first beat.
export const RUNNER_HEARTBEAT_MS = 60_000;

export function assertLeaseExceedsMs(
  leaseSeconds: number,
  minMs: number,
  leaseEnv: string,
  reason: string,
): void {
  if (leaseSeconds * 1000 > minMs) return;
  throw new Error(
    `${leaseEnv}=${leaseSeconds}s must exceed ${reason} (${minMs}ms); ` +
      `otherwise another worker reclaims the row mid-flight`,
  );
}

// Call once at process start, before serving or draining queues.
export function assertApiLeaseEnv(): void {
  const runLease = intEnv('AGENT_RUN_LEASE_SECONDS', 300);
  const runTimeoutMs = intEnv('AGENT_RUN_TIMEOUT_MS', 240_000);
  assertLeaseExceedsMs(runLease, runTimeoutMs, 'AGENT_RUN_LEASE_SECONDS', 'AGENT_RUN_TIMEOUT_MS');
  assertLeaseExceedsMs(
    runLease,
    RUNNER_HEARTBEAT_MS,
    'AGENT_RUN_LEASE_SECONDS',
    "the external runner's heartbeat",
  );
  assertLeaseExceedsMs(
    intEnv('AGENT_CHAT_LEASE_SECONDS', 300),
    RUNNER_HEARTBEAT_MS,
    'AGENT_CHAT_LEASE_SECONDS',
    "the external runner's heartbeat",
  );
}
