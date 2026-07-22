# worker — rules

Webhook delivery worker: a standalone Bun process that drains the
`webhook_delivery` queue and posts signed payloads to subscriber URLs. Runs as its
own service (own Dockerfile), separate from `apps/api`. See root `AGENTS.md`.

## What it does

- Polls `webhook_delivery` for due `pending` rows, claims a batch with
  `FOR UPDATE SKIP LOCKED`, posts each to its webhook URL, records the outcome.
- Signs every request: `X-Itsaplan-Signature: t=<ts>,v1=<hmac-sha256>` over
  `${ts}.${body}` with the webhook's `secret`. Plus `X-Itsaplan-Event`,
  `X-Itsaplan-Delivery`, `X-Itsaplan-Event-Id` (stable across retries).
- Retries transient failures (timeout, 429, 5xx) with equal-jitter exponential
  backoff up to `WEBHOOK_MAX_ATTEMPTS`; permanent 4xx fail immediately. After
  `WEBHOOK_DISABLE_THRESHOLD` consecutive failures the webhook is auto-disabled.

## Invariants

- **Reads/writes `@repo/db` directly, never the API over HTTP.** It is a DB
  consumer and an HTTP producer. It does not import `apps/api`.
- **No migrations here.** The api applies them on startup; the worker only uses
  existing tables and tolerates their brief absence (a tick logs and retries).
- **At-least-once delivery.** Duplicates are possible (a 2xx whose ACK is lost);
  the `event_id` is stable across retries so receivers deduplicate. Never mint a
  new id per attempt.
- **Claim leases, not a status flag.** Claiming pushes `next_attempt_at` forward
  by `WEBHOOK_LEASE_SECONDS`; a crashed delivery is reclaimed after the lease. Keep
  the lease comfortably larger than `WEBHOOK_TIMEOUT_MS`.
- **Pure logic stays dependency-free.** `backoff.ts`, `signature.ts`, and
  `isRetryableStatus` import nothing from `@repo/db`, so unit tests run without a
  database. Keep DB access in `store.ts`.

## Config

All via env with defaults (see `src/config.ts`): `WEBHOOK_POLL_INTERVAL_MS`,
`WEBHOOK_BATCH_SIZE`, `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_MAX_ATTEMPTS`,
`WEBHOOK_DISABLE_THRESHOLD`, `WEBHOOK_LEASE_SECONDS`, `WEBHOOK_CLEANUP_DAYS`,
`WEBHOOK_CLEANUP_EVERY_TICKS`. Only `DATABASE_URL` is required for webhook
delivery. Agent runs and notification delivery additionally need
`WORKER_INTERNAL_TOKEN` and an api origin (`SERVICE_URL_API`, else
`API_URL`); `internal-api.ts` throws when either is missing, no fallback
origin.

## Run

- Dev: `bun run dev` at the repo root runs it under turbo alongside api + web
  (watch mode, loads root `.env`).
- Prod: the `worker` service in `docker-compose.yml`.
