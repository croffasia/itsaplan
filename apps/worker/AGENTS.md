# worker — rules

Standalone Bun process (own Dockerfile, separate from `apps/api`) that drains a
few background queues: webhook delivery, notification delivery, agent
scheduling, and source imports. See root `AGENTS.md`.

## What it does

- Polls `webhook_delivery` for due `pending` rows, claims a batch with
  `FOR UPDATE SKIP LOCKED`, posts each to its webhook URL, records the outcome.
- Queues an `agent_run` row for every due `agent_schedule`.
- Signs every request: `X-Itsaplan-Signature: t=<ts>,v1=<hmac-sha256>` over
  `${ts}.${body}` with the webhook's `secret`. Plus `X-Itsaplan-Event`,
  `X-Itsaplan-Delivery`, `X-Itsaplan-Event-Id` (stable across retries).
- Retries transient failures (timeout, 429, 5xx) with equal-jitter exponential
  backoff up to `WEBHOOK_MAX_ATTEMPTS`; permanent 4xx fail immediately. After
  `WEBHOOK_DISABLE_THRESHOLD` consecutive failures the webhook is auto-disabled.
- Drains `notification_delivery` and sends each row itself: email through
  `@repo/mailer`, Telegram through the Bot API. The provider credentials are read
  from the database and decrypted here (`notification-send.ts`), so the process
  needs `APP_ENCRYPTION_KEY`.
- Drives `import_job` rows through Discover -> Create -> Link -> Attachments ->
  Done. See "Source imports" below.

## Source imports

`import-worker.ts` polls `import_job` for a due `pending` row (`import-store.ts`,
same claim-with-lease shape as `webhook_delivery`) and advances it by one bounded
chunk of work per tick — a large import interleaves across many ticks rather than
running to completion in one.

- `canonical.ts` — the source-independent shape an adapter produces
  (`CanonicalIssue`, `CanonicalState`, ...). Plain types, no logic.
- `reader.ts` — the `SourceReader` port a source adapter implements.
- `plane-adapter.ts` — the only implementation today. HTTP against a Plane
  instance via `pinnedFetch`, using the credential decrypted from the job row
  (base URL, workspace slug, API key — never from env, since this has to work
  against any operator's self-hosted instance). `docs/dev/plane-import-source-notes.md`
  is the spec it follows for pagination, rate limiting, and Plane's actual wire
  shapes.
- `import-store.ts` — all `@repo/db` access for imports: claiming due jobs,
  reading/writing a job's phase/cursor/status, the `import_record`
  source-id-to-local-id upsert, and creating the local rows (states, labels,
  cycles, issues, comments, issue links) an import produces.
- `import-worker.ts` — the phase state machine. Discover snapshots every
  source id up front (`import_record` rows with no local id yet) before Create
  begins, rather than treating the source's own pagination cursor as the
  resumability anchor across the whole job — see the notes file's "Pagination"
  section for why. Create/Link resume from `import_record`'s own id, not the
  source's cursor.
- Attachment byte download is not implemented yet: the Attachments phase
  closes the job out once Create/Link are done. `reader.ts` only lists
  attachment metadata per issue (captured during Create); resolving the
  two-hop, hour-lived download URL happens in a later phase, not before.

## Invariants

- **Reads/writes `@repo/db` directly, never the API over HTTP.** It is a DB
  consumer and an HTTP producer. It does not import `apps/api` and does not call it.
- **Notification credentials are read, never taken from the caller.** A delivery
  row names its project; the credentials come from the team that owns it and from
  the instance config. Nothing about the recipient or the provider is passed in
  from outside.
- **No migrations here.** The api applies them on startup; the worker only uses
  existing tables and tolerates their brief absence (a tick logs and retries).
- **At-least-once delivery.** Duplicates are possible (a 2xx whose ACK is lost);
  the `event_id` is stable across retries so receivers deduplicate. Never mint a
  new id per attempt.
- **Agent schedules are queued here, run in the api.** A due schedule gets an
  `agent_run` row; the api drains that queue, where the agent runtime and the model
  credentials live.
- **Claim leases, not a status flag.** Claiming pushes `next_attempt_at` forward
  by `WEBHOOK_LEASE_SECONDS`; a crashed delivery is reclaimed after the lease. Keep
  the lease comfortably larger than `WEBHOOK_TIMEOUT_MS`.
- **Pure logic stays dependency-free.** `backoff.ts`, `signature.ts`, and
  `isRetryableStatus` import nothing from `@repo/db`, so unit tests run without a
  database. Keep DB access in `store.ts`. Same split for imports: `canonical.ts`,
  `reader.ts`, and `plane-adapter.ts` import nothing from `@repo/db` (its state-
  category normalization, markdown conversion, and cursor/rate-limit logic are
  unit-tested directly); `@repo/db` access stays in `import-store.ts`.
- **An import job's credential is decrypted here, never routed through
  `packages/db/src/domains/`.** That directory is for config more than one
  process reads; only the worker ever decrypts a stored import credential (the
  api sees the raw token once, at creation, before it is encrypted).

## Config

All via env with defaults (see `src/config.ts`): `WEBHOOK_POLL_INTERVAL_MS`,
`WEBHOOK_BATCH_SIZE`, `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_MAX_ATTEMPTS`,
`WEBHOOK_DISABLE_THRESHOLD`, `WEBHOOK_LEASE_SECONDS`, `WEBHOOK_CLEANUP_DAYS`,
`WEBHOOK_CLEANUP_EVERY_TICKS`. Only `DATABASE_URL` is required for webhook
delivery. Notification delivery also needs `APP_ENCRYPTION_KEY` (the same value the
api uses) to read the stored provider credentials, and so does source import (it
decrypts the stored Plane credential with it too). `IMPORT_POLL_INTERVAL_MS` tunes
the import worker's poll interval.

## Tests

`src/__tests__/unit/` covers the pure logic with no database. `src/__tests__/integration/`
covers what needs one — the notification send reads its config from the database — and
runs against the test DB (`bun run test` loads `.env.test`; the Docker gate runs it
after the api and bot suites). It inserts the rows the api writes in production, the
way `apps/bot` does; there is no api to call.

## Run

- Dev: `bun run dev` at the repo root runs it under turbo alongside api + web
  (watch mode, loads root `.env`).
- Prod: the `worker` service in `docker-compose.yml`.
