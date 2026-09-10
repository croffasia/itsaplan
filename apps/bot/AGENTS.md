# bot — rules

Telegram bot service: a standalone Bun process running grammY long polling for the
instance bot. Its only job today is completing account links (`/start <code>`). See
root `AGENTS.md`.

## Invariants

- **Never import `@repo/db`.** Unlike the worker, this service has no database
  connection and no encryption key. Everything goes through the api's `/internal/telegram/*`
  routes with `WORKER_INTERNAL_TOKEN`. Keep it that way — the bot token and the user
  rows stay behind the api.
- **One replica only.** Telegram gives each `getUpdates` call to a single caller, so
  a second instance would steal updates from the first. Do not add replicas or run it
  alongside a webhook registration for the same bot.
- **The token is not env configuration.** It is stored in the database and edited in
  god mode, so `supervisor.ts` polls the api and starts/stops/replaces the bot when it
  changes. A new bot must work without a redeploy.
- **An error must not stop polling.** `bot.catch` swallows update failures and the
  supervisor loop tolerates the api being unreachable.

## Config

`WORKER_INTERNAL_TOKEN` is required. The api origin is not a variable of its own —
it resolves the same way the worker resolves it: `SERVICE_URL_API` in the compose
stack, `API_URL` locally. Do not add a third URL variable. Optional tuning:
`BOT_CONFIG_POLL_INTERVAL_MS`, `BOT_API_TIMEOUT_MS` (see `src/config.ts`).

## Growing it

grammY ships `webhookCallback(bot, 'elysia')`, so moving from polling to a webhook
mounted on the api is a swap of the transport, not of the framework. Commands beyond
`/start` go in `bot.ts`; anything needing project data gets a new `/internal/telegram/*`
route rather than a database import.

## Run

- Dev: `bun run dev` at the repo root runs it under turbo alongside api + web + worker.
- Prod: the `bot` service in `docker-compose.yml`.
