# Local development

Requirements: [Bun](https://bun.sh) 1.3+, Docker, Git.

## Setup

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
bun install
bun run setup   # answer "Develop"
bun run dev     # api + web together, via Turborepo
```

`bun run setup` asks what you are setting up and does the rest. Answer **Develop** and it
writes `.env`, `apps/web/.env` and `.env.test`, generates the secrets, starts Postgres and
MinIO, creates the separate test database, and applies both sets of migrations.

Run it again later and it stops the dev stack, starts it again, and re-applies the
migrations; the databases keep their data. If the credentials in `.env` no longer match the
ones the database was created with, it says so and offers to recreate it — which deletes
what is in it. The other answer, **Try it**, sets up a running
instance instead of a workspace: the whole stack in Docker on localhost, opened in your
browser.

The apps run on: web <http://localhost:3001>, api <http://localhost:3000>, MinIO console
<http://localhost:9001>. `bun run dev` runs the whole workspace in watch mode from the repo
root. The dev compose starts only Postgres and MinIO; the apps themselves run on the host.

The third answer, **Generate env**, writes no stack at all. It walks the Postgres user,
password and database and the three secrets, one prefilled prompt each, over values built
from the `.example` files rather than from the `.env` you already have, and then asks
whether to write the two files or print them instead. It starts nothing and needs no Docker.

Host port 5432 is often taken by a local Postgres. The setup asks for another port and
writes it to both `POSTGRES_PORT` and `DATABASE_URL`; the api port works the same way.

## Environment

Three files, all written by `bun run setup`:

| File            | Read by                                       |
| --------------- | --------------------------------------------- |
| `.env`          | api, worker, bot, drizzle                     |
| `apps/web/.env` | web — Next reads env only from its own folder |
| `.env.test`     | the api test suite                            |

`.env.example` matches the dev compose: `API_URL`, `APP_URL` and the MinIO credentials work
on localhost without a change. Three secrets have no usable default and are generated:

| Variable                | Used for                                          |
| ----------------------- | ------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | signing sessions                                  |
| `APP_ENCRYPTION_KEY`    | encrypting AI provider keys at rest               |
| `WORKER_INTERNAL_TOKEN` | api ↔ worker ↔ bot calls; one value for all three |

A secret is only generated while the Postgres volume does not exist, and one that already
holds a real value is kept in any case — past the first start the instance is using those
values and a new one would lock it out of its own data. A port held by a container of this
project counts as free. So the setup is safe to run again on a live instance.
`bun run setup:env` is the same script without the questions: it writes `.env` and
`apps/web/.env` with generated secrets and touches nothing else. Every other variable is
optional, and `.env.example` documents it.

## Commands

Run everything from the repository root through Turborepo. Use `bun`, never npm, yarn, or
pnpm: the lockfile is `bun.lock`.

| Command               | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `bun run dev`         | all apps in watch mode                       |
| `bun run typecheck`   | `tsc --noEmit` across the workspace          |
| `bun run lint`        | ESLint                                       |
| `bun run format`      | Prettier, writes                             |
| `bun run db:generate` | generate a migration from the Drizzle schema |
| `bun run db:migrate`  | apply migrations                             |
| `bun run test`        | all test suites                              |

## Tests

Tests run against a real test Postgres, not mocks. `bun run setup` prepared it already —
a separate `*_test` database on the same dev Postgres, migrated, with `.env.test` pointing
at it. Run the suite from the repo root:

```bash
bun run test
```

The database has to be separate: the reset helper TRUNCATEs every table between tests, and
refuses to run unless the database name contains "test". MinIO is shared with dev — the
attachments suite only writes uuid-keyed objects into the bucket compose creates, and
deletes them again.

You can also run the same gate CI uses: the suite against a throwaway Postgres, in a
container built from the production image:

```bash
docker compose -f docker-compose.test.yml build
docker compose -f docker-compose.test.yml run --rm api-test
```

`run` starts the dependencies, runs the suite, and exits with its code.

The integration suite is in `apps/api`. `apps/api/AGENTS.md` explains how to write a test.

## Internals

[`docs/dev/`](dev/) describes the mechanisms that span several apps:

- [The revision engine](dev/revision-engine.md) — how an open screen stays current.
- [Languages](dev/i18n.md) — how the app resolves the interface language, and how to add one.
