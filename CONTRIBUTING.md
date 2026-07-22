# Contributing to It's a Plan

Thanks for wanting to help. This document covers how to get the project running, what
the code conventions are, and how a change gets merged.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bug**: open an issue with the bug template, or comment on an existing one.
- **Feature**: open an issue with the feature template first. Agreeing on the behaviour
  before the code is written saves a rewrite.
- **Small fixes** (typos, broken links, obvious one-liners) can go straight to a pull
  request without an issue.
- Look for issues labelled `good first issue` if you want a place to start.

## Development setup

Requirements: [Bun](https://bun.sh) 1.3+, Docker, Git.

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
bun install

cp .env.example .env
cp apps/web/.env.example apps/web/.env

# BETTER_AUTH_SECRET, APP_ENCRYPTION_KEY, WORKER_INTERNAL_TOKEN in .env:
openssl rand -base64 32

# Postgres and MinIO for local development
docker compose -f docker-compose.dev.yml up -d
# If host port 5432 is taken, use another one and update DATABASE_URL in .env:
#   POSTGRES_PORT=5433 docker compose -f docker-compose.dev.yml up -d

bun run db:migrate
bun run dev
```

The apps run on: web `:3001`, api `:3000`, MinIO console `:9001`.

Run everything from the repository root through Turborepo. Use `bun`, never npm, yarn,
or pnpm: the lockfile is `bun.lock`.

| Command               | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `bun run dev`         | all apps in watch mode                       |
| `bun run typecheck`   | `tsc --noEmit` across the workspace          |
| `bun run lint`        | ESLint                                       |
| `bun run format`      | Prettier, writes                             |
| `bun run db:generate` | generate a migration from the Drizzle schema |
| `bun run db:migrate`  | apply migrations                             |

## Project layout

```
apps/api        Elysia (Bun) HTTP API, mounts better-auth at /api/auth/*
apps/web        Next.js App Router, server-side rendered
apps/worker     background jobs: webhooks, notifications, agent runs
apps/bot        Telegram bot, long polling
packages/db     Drizzle client, schema, migrations
packages/auth   better-auth server instance
packages/crypto AES-256-GCM encryption for secrets at rest
packages/mailer SMTP and Resend transport
```

Dependency direction is `api → @repo/auth → @repo/db`. The web app never imports the
packages directly, it talks to the API over HTTP.

Each app and package has a `AGENTS.md` with the rules that apply inside it. Read the one
for the area you are changing.

## Code conventions

- **KISS and YAGNI.** The simplest thing that works. No abstraction until more than one
  concrete implementation needs it.
- **Follow the existing patterns.** Read the neighbouring code before adding a new file,
  and reuse the shared components and utilities instead of adding parallel ones.
- **All code, comments, and strings are in English.**
- Shared packages are consumed as TypeScript source. Do not add a build step for them.
- Formatting and linting are enforced by a pre-commit hook (lefthook), and again in CI.

### Database changes

Edit the Drizzle schema in `packages/db/src/schema`, then generate and apply:

```bash
bun run db:generate   # writes SQL to packages/db/drizzle
bun run db:migrate
```

Commit the generated SQL. Never edit a migration that has already been merged, add a new
one instead. Changing the better-auth config in `packages/auth` can change its tables:
run `bun run auth:generate` first, then generate the migration.

### Tests

`apps/api` has an integration suite that runs against a real Postgres, not mocks. See
`apps/api/AGENTS.md` for how to write one.

```bash
cp .env.test.example .env.test
bun run db:migrate:test
bun run test
```

CI runs the same suite through `docker-compose.test.yml` against a throwaway database.
You can run the full gate locally:

```bash
docker compose -f docker-compose.test.yml up --build \
  --abort-on-container-exit --exit-code-from api-test
```

## Pull requests

1. Branch off `main`: `git checkout -b feat/short-description`.
2. Keep the change focused. One concern per pull request.
3. Title follows [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(web): add issue templates`, `fix(api): reject empty label names`,
   `docs: ...`, `refactor: ...`, `chore: ...`.
4. Before pushing, make sure these pass:

   ```bash
   bun run format:check && bun run lint && bun run typecheck
   ```

5. Fill in the pull request template, link the issue (`Closes #123`), and add
   screenshots for UI changes.
6. CI must be green before review.

## Licence

Contributions are licensed under [AGPL-3.0](LICENSE), the same licence as the project.
