# worker

Standalone Bun process (own Dockerfile). `start.ts` runs three poll loops: `worker.ts` (webhook and
notification delivery, webhook cleanup, telemetry), `agent-worker.ts` (cron schedules) and
`import-worker.ts` (source imports). Webhook defaults are in `src/config.ts`; other settings are
read with `intEnv` where they are used. The import pipeline: `docs/dev/import-worker.md`.

## Invariants

- **Reads and writes `@repo/db` directly, never the API over HTTP.** It does not import `apps/api`.
- **No migrations here.** Compose and Helm apply them in a separate step and the worker waits. On
  Railway and a plain `docker run` the api applies them at startup, so the worker can start first.
- **A DB error is retried and can use up attempts.** `poll-loop.ts` logs a failed claim and the next
  tick retries. During a notification send or an import phase the error goes only to `last_error`
  and counts as an attempt.
- **Queued webhooks are at-least-once.** `event_id` is set at enqueue and sent in
  `X-Itsaplan-Event-Id`, so receivers deduplicate. Never mint a new id per attempt. Notifications
  have no `event_id`: a retry can send a duplicate.
- **The worker queues cron schedules and runs no agent.** A due `cron` schedule of an active
  project gets an `agent_run` row. The api queues the other runs and executes internal agents. A
  runner or an invocation endpoint executes external ones.
- **Claims use a lease; `status` stays `pending`.** A claim pushes `next_attempt_at` forward by
  `WEBHOOK_LEASE_SECONDS`, `NOTIFICATION_LEASE_SECONDS`, or `LEASE_SECONDS` in `import-store.ts`.
  Cron schedules use a row lock in a transaction instead.
- **Keep `WEBHOOK_LEASE_SECONDS` above `WEBHOOK_TIMEOUT_MS`; no code checks it.** The timeout is a
  socket idle timeout, so a receiver that keeps sending bytes can outlast the lease.
- **Notification credentials are read, never taken from the caller.** A delivery row names its
  project; credentials come from the owning team and the instance config.
- **Always send a supplied URL through `pinnedFetch` from `@repo/net`, the SSRF guard.** That covers
  webhook URLs, import source hosts and attachment links.
- **Pure logic stays free of `@repo/db`.** `backoff.ts`, `reader.ts`, `*-adapter.ts` and
  `*-mapping.ts` import nothing from it, so unit tests run without a database.
- **An import job's credential is decrypted here, never routed through
  `packages/db/src/domains/`.** Only the worker decrypts it.
- A new import source needs a `SourceReader` adapter, an entry in `import-sources.ts`, api routes
  and a web form. The phases do not change. Rewrite makes no requests to the source.
- **Only `AttachmentRejectedError` is logged and skipped.** Any other attachment error fails the
  tick, an SSRF refusal (`UrlNotAllowedError`) included. `MAX_ATTEMPTS` failed ticks in a row fail
  the job (`import-retry.ts`).

## Tests

`src/__tests__/unit/` covers pure logic with no database. `src/__tests__/integration/` runs against
the test DB, and `import-store.test.ts` also uses the S3 test store. These tests insert the rows the
api writes in production; there is no api to call.
