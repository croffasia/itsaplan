# api tests: setup

How to write a test is in `apps/api/AGENTS.md`.

`bun test` drives the app in memory with Eden Treaty against a real test Postgres and real
better-auth sessions. No mock library is used. External services are replaced at the network
boundary: a local `Bun.serve` stub, a fake SMTP listener or a `globalThis.fetch` override. Tests
import `app` through the helpers, from `src/app.ts`. `src/index.ts` binds the port.

## Setup

`bun run setup` at the repo root, in the Develop mode, creates the `<dev database>_test` database
next to the dev one, writes `.env.test`, and migrates both databases. By hand, with the dev stack
running:

```bash
cp .env.test.example .env.test   # match DATABASE_URL to the root .env
docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U itsaplan -d itsaplan -c 'CREATE DATABASE itsaplan_test'
bun run db:migrate:test          # repo root
```

The database name must contain `test` and `NODE_ENV` must be `test`: `resetDb` refuses to run
otherwise. The Postgres role must be a superuser, as the dev role is: `resetDb` sets
`session_replication_role`, and the preload creates databases.

Tests do not migrate. After a new migration, run `bun run db:migrate:test`.

## Running

| Command                                      | Folder     | Runs                                       |
| -------------------------------------------- | ---------- | ------------------------------------------ |
| `bun run test`                               | repo root  | `scripts/` tests, then every member's suite |
| `bun run test`                               | `apps/api` | the api suite in up to 5 workers           |
| `bun test --env-file=../../.env.test <path>` | `apps/api` | one process on the test database itself    |

## Workers

The api `test` script is `bun test --env-file=../../.env.test --parallel=5 --no-isolate`. With
`--no-isolate`, `src/__tests__/preload.ts` runs once per worker. It drops and recreates the worker's
copy of the test database, named `<name>_<worker>`, for example `itsaplan_test_3`, and points
`DATABASE_URL` at it. The copies stay on the server until the next run replaces them.

- Nothing may be connected to the test database when a worker starts: Postgres refuses to copy a
  database that has open sessions. The root `bun run test` runs the api, bot, worker and `@repo/db`
  suites one at a time, because bot, worker and `@repo/db` use the test database itself.
- Do not start two api runs at once. The second run drops the copies the first run is using.
- With `--no-isolate`, a worker keeps one set of globals and modules across its files. A change to
  `process.env`, `globalThis.fetch` or a process-wide provider such as `setLimits` carries into the
  next file unless the test restores it.
- A worker can open up to 30 Postgres connections on demand: 10 for the `@repo/db` client and 20 for
  the Mastra store. Postgres allows 100 by default, and the dev stack uses the same server. Check
  that limit before you raise the worker count.

The preload also hashes passwords with scrypt at its lowest cost, because nearly every test creates
users. `apps/api/bunfig.toml` loads it for `bun test` only.

## S3

A test that uploads a file or writes an agent skill needs RustFS and `S3_*` in `.env.test`, and
fails without them. `docker compose -f docker-compose.dev.yml up -d` starts RustFS and creates the
bucket. The Docker test gate (`docker-compose.test.yml`) starts its own throwaway RustFS.

## Layout

Test files are in `__tests__/` folders, mostly inside the module they cover:

- `integration/`: Treaty against the app and the test database.
- `unit/`: pure functions, imported directly, with no session, HTTP or query.

Helpers are in `src/__tests__/helpers/` and are imported as `#tests/helpers/<file>`:

- `api` is the anonymous client. `authedApi(cookie, headers?)` is a client with a session.
- `signUpTestUser(overrides?)` returns `{ cookie, userId, email, username, workspaceId }`.
- `resetDb()` empties the `public` schema except `__drizzle_migrations` and `oauth_resource`. Each
  test file calls it in its own `beforeEach`. The preload does not call it.

The same folder has helpers for projects, agents, roles, members, limits, MCP and credentials.
`modules/god/__tests__/helpers.ts` and `modules/scim/__tests__/helpers.ts` serve those modules.
