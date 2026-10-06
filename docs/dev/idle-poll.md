# Idle poll backoff (developer notes)

Operator-facing tuning, charts, and env defaults live in
[`docs/idle-poll/`](../idle-poll/). This page is for maintainers: why the change
exists, where the code sits, and what was verified.

## Problem

Several loops wake on a fixed interval while their queues are empty:

- api background agent-run drain (~2 s)
- worker webhooks / schedules / imports (~2–3 s)
- chat claim long-poll internals (~500 ms between empty DB looks)
- `@itsaplan/runner` HTTP claim of queued runs (~3 s)

On a quiet instance that is a steady stream of empty Postgres checks and, for an
external runner, empty HTTP claims. That shows up as egress and DB load on
hosted Postgres (including Supabase) and as cost on always-on or metered
workers — separate from board sync via the [revision engine](revision-engine.md).

WebSockets / Realtime were considered for a larger cut. They do not fit this
codebase cheaply (permissions model, runner protocol, hosting). Exponential
idle backoff is the small change that cuts the quiet-hour floor without a new
transport.

## Design

`nextIdlePollMs(emptyStreak, baseMs, capMs)`:

- streak `0` → `baseMs`
- each further empty → double, capped at `max(baseMs, capMs)`
- a busy tick resets the streak

A base already above the configured cap is left alone: the cap never shortens a
high base. That is deliberate so `INTERVAL=120000` with a forgotten low `MAX`
does not silently speed the loop up.

The helper is **copied** next to api (`apps/api/src/shared/idle-poll.ts`),
worker (`apps/worker/src/idle-poll.ts`), and the published runner
(`packages/runner/src/idle-poll.ts`). Eight lines do not justify a workspace
package (Dockerfile `COPY` lists, and the npm-published runner cannot depend on
a private `@repo/*`). Revisit if a fourth copy appears, or if
`equalJitterBackoffMs` is extracted with it.

### Where it is wired

| Loop | Location | Base / max env |
| ---- | -------- | -------------- |
| Chat claim wait | `claimNextMessage` in `apps/api/.../chat/service.ts` | `AGENT_CHAT_CLAIM_POLL_*` |
| Internal agent runs | `apps/api/src/background.ts` | `AGENT_RUN_POLL_INTERVAL_*` |
| Webhooks | `apps/worker` poll-loop via `workerConfig` | `WEBHOOK_POLL_INTERVAL_*` |
| Schedules / agent-worker | `apps/worker/src/agent-worker.ts` | `AGENT_RUN_POLL_INTERVAL_*` |
| Imports | `apps/worker/src/import-worker.ts` | `IMPORT_POLL_INTERVAL_*` |
| Runner run claims | `packages/runner/src/cli.ts` | `ITSAPLAN_POLL_INTERVAL_*` / config JSON |

New vars are optional `*_INTERVAL_MAX_MS` (or `pollIntervalMaxMs`) pairs next to
the existing interval names — no renames of the bases, so existing installs keep
working.

`IDLE_POLL_DEBUG=1` logs `[label] idle Nms (streak K)` (same idea as
`TELEMETRY_DEBUG`).

### Chat claim vs runner

The external runner does not implement chat backoff itself. It calls
`POST /agent-chats/claim`; the server long-polls and applies backoff **inside**
that wait (Postgres). Presence (`lastSeenAt`) is updated on claim. Runner
**runs** still poll over HTTP; their backoff is client-side.

Internal agents never use the runner: `background/agent-runs` is the api loop.

## Lease floors (related hardening)

While checking which mis-tunings can break the system, the dangerous class was
not `MAX < base` (that only disables backoff). It was **lease shorter than the
work or than the runner heartbeat**:

- webhook lease ≤ HTTP timeout → duplicate deliveries
- notification lease too short → duplicate sends
- agent-run lease ≤ run timeout (internal, no heartbeat) → double execution
- agent-run / chat lease ≤ 60 s → re-claim before the runner's first heartbeat

`assertApiLeaseEnv` / `assertWorkerLeaseEnv` run at process start and throw so
api and worker refuse to boot. `AGENT_CHAT_CLAIM_WAIT_MS` was already clamped to
30 s against the runner's 35 s HTTP timeout; that clamp stays.

`MAX < base` for idle polls stays a silent raise of the cap to the base (unit
tested). No startup failure for that pair.

## Operator doc and charts

[`docs/idle-poll/`](../idle-poll/) is the install/tuning guide (defaults, env,
embedded charts). The PNGs there are produced by `docs/dev/plot-idle-poll.py`.
The chat series resets the empty streak every `AGENT_CHAT_CLAIM_WAIT_MS` (25 s),
because `claimNextMessage` starts `emptyStreak` at 0 on each claim. The other
loops keep their streak across ticks.

### Regenerating the charts

When the defaults in code or `.env.example` change, update `LOOPS` in
`docs/dev/plot-idle-poll.py` and regenerate into `docs/idle-poll/`:

```bash
python3 -m venv .venv-plot
.venv-plot/bin/pip install matplotlib
.venv-plot/bin/python docs/dev/plot-idle-poll.py
```

Useful flags: `--only linear|log`, `--horizon-hours 2`, `--out-dir path`.
Then refresh the table in the operator README from the script's stdout.

## Tests

**Unit**

- `nextIdlePollMs` in api, worker, and runner packages (base, double, cap, cap
  below base).
- `assertLeaseExceedsMs` in api and worker.

**Local smoke (manual)**

- `IDLE_POLL_DEBUG=1` + `bun run dev`: idle logs climb to the cap and reset on
  work; external runner on the LAN updates `last_seen_at` and drives
  `[agent-chat-claim]` on the api.
- Bad env written into `.env`, then `bun --env-file=.env run src/index.ts` for
  api / worker:

  | Setting | Expected |
  | ------- | -------- |
  | `WEBHOOK_LEASE_SECONDS=5`, `WEBHOOK_TIMEOUT_MS=30000` | worker exit 1 |
  | `AGENT_RUN_LEASE_SECONDS=60`, `AGENT_RUN_TIMEOUT_MS=240000` | api exit 1 |
  | `AGENT_CHAT_LEASE_SECONDS=30` | api exit 1 |
  | `NOTIFICATION_LEASE_SECONDS=10` | worker exit 1 |
  | defaults | both start |

  Restore `.env` after the bad cases.

## Out of scope / non-goals

- Replacing poll with WebSockets or Supabase Realtime.
- Changing auto-archive cadence (`AUTO_ARCHIVE_INTERVAL_MS` stays its own fixed
  loop).
- A shared `@repo/idle-poll` package (see Design).
- Blocking startup when idle `MAX <` base.
