---
name: itsaplan-repo-verification-runs
description: Use when running root typecheck, lint, or format:check.
category: tooling
---

# itsaplan repo verification runs

Run each root check in its own Bash call with an explicit `timeout` of 300000. `bun run typecheck` at the root runs turbo across every app and takes about two minutes, so a chained call (`cd x; bun run typecheck; bun run lint; bun run format:check`) passes the 120s Bash limit and is moved to the background.

- For a web-only change, run `bun --filter=web run typecheck` (see `next-intl-message-keys`). Run the root typecheck only when a shared package changed.
- Read the error text of any failing package before reporting it as unrelated to your change. Do not write "not my files" without seeing the error.
- `format:check` reports pre-existing `.claude/autoharness` JSON files. Those are covered by `format-check-autoharness-artifacts`; report them separately from your own files.
- Wait for the background-task notice rather than sleep-polling (see `bounded-background-wait-loops`).
- `.env.test` must match the ports the api tests assert. Here `API_URL` in `.env.test` was `localhost:3001` while the tests expect `localhost:3000`, and the OIDC `redirectUri` and SCIM `baseUrl` tests failed on that alone. Check `API_URL` before reading those failures as code bugs.
- The api, bot and worker suites share one test database and the api suite truncates every table before each test. Never start a `bun test` or `bun run test` while another agent or process may be running one: overlapping runs fail with errors such as a failed TRUNCATE or "caller owns no team", which look like code bugs. Check for a running test process (`pgrep -fl "bun test"`) and wait for it to exit first. When other agents share the checkout, serialize api test runs with a directory lock: `until mkdir /tmp/<name>.lock 2>/dev/null; do sleep 10; done; bun test ...; rmdir /tmp/<name>.lock`.
- The api suite saves LLM integration credentials with a base URL. `checkLlmBaseUrl` in `agents/integrations/service.ts` rejects a `localhost` or private host with 400 unless its `host:port` is listed in `LLM_ALLOWED_PRIVATE_HOSTS`. Failures such as "ends a run that reaches maxSteps" or "sends the reasoning effort" with `TypeError: null is not an object ... integrations.post` come from that 400, not from the run logic. Check the create response status before reading them as code bugs.
