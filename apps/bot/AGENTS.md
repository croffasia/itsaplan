# bot — rules

Telegram bot service: a standalone Bun process running grammY long polling for the
instance bot. Its only job today is completing account links (`/start <code>`). See
root `AGENTS.md`.

## Invariants

- **The bot talks to Postgres and Telegram, and to nothing else.** Its queries are in
  `src/db.ts`, over the schema of `@repo/db`, so it needs `DATABASE_URL` and
  `APP_ENCRYPTION_KEY`. It holds no api credential and makes no call to the api — a
  secret that never crosses the network cannot be read off it.
- **The bot settings row is the api's.** The api writes `telegram.bot` in `app_secret`;
  the bot reads it through `@repo/db` (`domains/telegram-bot.ts`), which is also where
  a new field on that config goes.
- **One replica only.** Telegram gives each `getUpdates` call to a single caller, so
  a second instance would steal updates from the first. Do not add replicas or run it
  alongside a webhook registration for the same bot.
- **The token is not env configuration.** It is stored in the database and edited in
  god mode, so `supervisor.ts` polls it and starts/stops/replaces the bot when it
  changes. A new bot must work without a redeploy.
- **An error must not stop polling.** `bot.catch` swallows update failures and the
  supervisor loop tolerates the database being unreachable.

## Config

`DATABASE_URL` and `APP_ENCRYPTION_KEY` are required — the same values the api uses.
Optional tuning: `BOT_CONFIG_POLL_INTERVAL_MS`, `BOT_CONFIG_RETRY_INTERVAL_MS` (see
`src/config.ts`).

## Growing it

grammY ships `webhookCallback(bot, 'elysia')`, so moving from polling to a webhook
mounted on the api is a swap of the transport, not of the framework. Commands beyond
`/start` go in `bot.ts`, the queries they need in `db.ts`.

## Tests

`src/db.test.ts` covers redeeming a `/start` code against the test database
(`bun run test` loads `.env.test`; the Docker gate runs it after the api suite). It
inserts the pending rows the api mints in production — there is no api to call.

## Run

- Dev: `bun run dev` at the repo root runs it under turbo alongside api + web + worker.
- Prod: the `bot` service in `docker-compose.yml`.
