# Local development

Requirements: [Bun](https://bun.sh) 1.3+, Docker, Git.

## Setup

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
bun install

cp .env.example .env
cp apps/web/.env.example apps/web/.env

# BETTER_AUTH_SECRET, APP_ENCRYPTION_KEY, WORKER_INTERNAL_TOKEN in .env:
openssl rand -base64 32

docker compose -f docker-compose.dev.yml up -d   # Postgres + MinIO only
bun run db:migrate
bun run dev                                      # api + web together, via Turborepo
```

The apps run on: web <http://localhost:7003>, api <http://localhost:7002>, MinIO console
<http://localhost:9001>. `bun run dev` runs the whole workspace in watch mode from the repo
root; the dev compose brings up only the backing services and the apps run on the host.

If host port 5432 is taken, set another one and update `DATABASE_URL` in `.env`:

```bash
POSTGRES_PORT=5433 docker compose -f docker-compose.dev.yml up -d
```

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

Tests run against a real test Postgres, not mocks. Prepare a dedicated `*_test` database
once, then run the suite from the repo root:

```bash
cp .env.test.example .env.test   # DATABASE_URL must name a *_test database
bun run db:migrate:test          # migrate the test database
bun run test                     # run all suites via Turborepo
```

The dev compose (`docker-compose.dev.yml`) provides Postgres and MinIO for these tests; the
attachments suite needs the MinIO bucket it creates.

Alternatively, run the same gate CI uses — the suite against a throwaway Postgres in a
container built from the production image:

```bash
docker compose -f docker-compose.test.yml build
docker compose -f docker-compose.test.yml run --rm api-test
```

`run` starts the dependencies, runs the suite, and exits with its code.

`apps/api` has the integration suite; `apps/api/AGENTS.md` covers how to write one.

## Internals

Descriptions of the mechanisms that span several apps live in [`docs/dev/`](dev/):

- [The revision engine](dev/revision-engine.md) — how an open screen stays current.
- [Languages](dev/i18n.md) — how the interface language is resolved, and how to add one.
