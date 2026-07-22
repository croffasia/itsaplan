# AGENTS.md

Bun + Turborepo monorepo. Backend **Elysia**, frontend **Next.js (SSR)** + **shadcn/ui**,
auth **better-auth**, ORM **Drizzle** + PostgreSQL. Self-hosted with Docker Compose;
Coolify is the deploy target of the reference instance.

Prefer the most specific `AGENTS.md` for the area being changed: every app and some packages
have their own, and it wins over this file. The `CLAUDE.md` next to it is a pointer, not a
second source.

## Core Coding Principles

**IMPORTANT — always follow, no exceptions:** Follow KISS and YAGNI. Write the simplest
thing that works, avoid premature abstractions, and don't add them until multiple concrete
implementations actually need them. No overengineering.

Before writing new code, study the existing codebase and follow its established patterns and
conventions when they are sound. Reuse existing shared modules, components, and utilities
instead of duplicating or reinventing them; extend what's there rather than adding parallel
solutions.

## Writing style (docs, comments, chat)

Write plainly and literally. This applies to all prose: documentation, code comments, commit
messages, and chat replies.

- No metaphors, no personification, no figurative language. Do not write "the parser is the
  heart of the step", "data lives in Postgres", "self-healing queue", "the ticket flows through
  the pipeline". State the fact directly: "the parser is the main task of the step", "data is
  stored in Postgres", "a failed donor is retried on the next run".
- No rhetorical flourishes or dramatization. Describe what something does, not how important or
  elegant it is.
- Technical terms that happen to be metaphors in origin (watermark, backlog, queue, pipeline)
  are fine — they are standard terminology, not stylistic choices.
- Prefer short, direct sentences over expressive ones.

**Write the final state, not the edit history.** When the user changes a decision, rewrite
docs/comments to describe only the current design. Do not record the transformation of their
thinking.

- Do not write "not X, but Y", "now in the DB instead of in code", "decided", "moved from a
  separate step", "previously we planned". Just state Y.
- Do not annotate a choice with why it replaced an earlier idea from this conversation. The
  reader wants the current requirement, not how we got here.
- Forward-looking design rationale ("column `project_key` is added now so steps 3–4 need no
  migration") and cross-references between sections are fine — they explain the current design,
  not a discarded one.
- A discarded idea is only worth mentioning if it is a lasting "considered and rejected
  because…" that a future reader would otherwise re-propose — and then state it once, plainly,
  not as a correction to a prior draft.

## Golden rules

- **Runtime is Bun**, never npm/yarn/pnpm. Install with `bun install`, run scripts with `bun run`.
- **All code, comments, and strings are in English.**
- Cross-package imports use the workspace protocol: `"@repo/db": "workspace:*"`. Packages
  export raw `.ts` (see each package's `exports`) — Bun and Next transpile them, no build step.
- Run tasks from the **repo root** via Turborepo: `bun run dev` / `build` / `typecheck`.

## Layout

```
apps/api        Elysia (Bun) — mounts better-auth at /api/auth/*        :3000
apps/web        Next.js App Router, SSR (not SPA) + shadcn + TanStack Q :3001
apps/worker     webhook and notification delivery, agent runs, schedules
apps/bot        Telegram bot, long polling
packages/db     @repo/db     — Drizzle client, schema, migrations
packages/auth   @repo/auth   — better-auth server instance + instance auth settings
packages/crypto @repo/crypto — AES-256-GCM encryption for secrets at rest
packages/mailer @repo/mailer — SMTP/Resend transport for outbound email
packages/agent-tools @repo/agent-tools — tool definitions for the AI agent runtime
packages/eslint-config @repo/eslint-config — shared ESLint config
```

Dependency graph: `api → @repo/auth → @repo/db`. **The web app never imports packages
directly** — it talks to the API over HTTP (better-auth client + fetch).

## Commands (from root)

| Command                   | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `bun run dev`             | api + web in watch mode (turbo)                                  |
| `bun run build`           | build all apps                                                   |
| `bun run typecheck`       | tsc across the workspace                                         |
| `bun run lint`            | ESLint across the workspace                                      |
| `bun run format:check`    | Prettier check (CI runs the same)                                |
| `bun run test`            | run each app's test suite (turbo)                                |
| `bun run db:generate`     | generate SQL migrations from Drizzle schema                      |
| `bun run db:migrate`      | apply migrations                                                 |
| `bun run db:migrate:test` | apply migrations to the test DB (`.env.test`)                    |
| `bun run auth:generate`   | regenerate better-auth tables → `packages/db/src/schema/auth.ts` |

## First run

```bash
bun install
cp .env.example .env && cp apps/web/.env.example apps/web/.env
# set BETTER_AUTH_SECRET in .env:  openssl rand -base64 32
docker compose -f docker-compose.dev.yml up -d   # dev Postgres + MinIO
bun run db:migrate                               # apply migrations
bun run dev                                       # api :3000 + web :3001
```

## Environment

- Root `.env` (copy from `.env.example`) feeds api, drizzle, and docker-compose.
  Bun apps load it via `--env-file=../../.env`; drizzle via `dotenv` in `drizzle.config.ts`.
- `apps/web/.env` is **separate** — Next reads env only from its own folder. It holds
  `NEXT_PUBLIC_API_URL` (same value as the root `API_URL`); in the Docker build it comes
  from a build arg. `NEXT_PUBLIC_*` are inlined at **build time**.
- Local dev DB: `docker compose -f docker-compose.dev.yml up -d` (the deploy composes do
  NOT publish the DB port). **Host 5432 is often taken** → use `POSTGRES_PORT=5433` and set
  `DATABASE_URL=...localhost:5433...` in `.env`.
- A new environment variable belongs in `.env.example` and, if a service needs it, in the
  compose files.

## Compose files

| File                         | Purpose                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.dev.yml`     | local backing services only: Postgres + MinIO. The apps run on the host.                                                                          |
| `docker-compose.yml`         | self-hosting stack. Builds every service from source (`docker compose up -d --build`), reads a plain `.env`, requires the secrets via `${VAR:?}`. |
| `docker-compose.coolify.yml` | the same stack for Coolify: reads its generated `SERVICE_*` variables and builds the images from source.                                          |
| `docker-compose.test.yml`    | test gate against a throwaway Postgres.                                                                                                           |

A change to the deploy stack usually has to land in **both** `docker-compose.yml` and
`docker-compose.coolify.yml`. The **api applies migrations on startup** (`migrate.ts` in
its Dockerfile CMD). `bot` runs Telegram long polling and must stay at one replica.

## Test gate (Docker)

`docker-compose.test.yml` runs the test suite against a throwaway Postgres, in a
container built from the same image as production. Integration tests need a live
database, so they cannot run during `docker build` — this compose file is the
mechanism instead. Build the images, then run the suite (non-zero exit on any
failing test):

```bash
docker compose -f docker-compose.test.yml build
docker compose -f docker-compose.test.yml run --rm api-test
```

`run` starts api-test's dependencies (Postgres healthy, the MinIO bucket init
completed), runs the suite, and exits with its code. It does not use
`--abort-on-container-exit`, which tears the stack down the moment the one-shot
`minio-test-init` exits, before api-test starts.

The test database is created by the `postgres-test` service (`POSTGRES_DB=vela_test`,
tmpfs — nothing persists). The `test` job in `.github/workflows/ci.yml` runs these
same commands.

## CI

`.github/workflows/ci.yml` runs on every pull request: `format:check` + `lint` +
`typecheck`, an app build, and the compose test gate. `codeql.yml` scans for security
issues. Do not add a workflow that duplicates a job an existing one already runs.

Images are not published to a registry: every deploy builds from source
(`docker compose up -d --build`).

## Commits and releases

Versioning is automated by release-please (`release.yml`). It reads the
Conventional Commit subjects that land on `main` and keeps an open release PR
that accumulates the next version and `CHANGELOG.md`. `feat:` bumps the minor,
`fix:` the patch, `!` (e.g. `feat!:`) the major — but while the version is
`0.x`, a breaking change bumps the minor, not the major. Merging the release PR
tags the commit and publishes the GitHub Release. PR titles are squash-merged
into `main`, so the PR title is the commit subject release-please reads; it must
be a valid Conventional Commit (enforced by `pr-title.yml`).

**Agents do not commit.** Do the work, then write the proposed commit message in
chat as a Conventional Commit (`type(scope): summary`) for the user to run. Do
not call `git commit` or `git push` unless the user explicitly asks.

## Before pushing a branch (agents)

Run the changed code through two skills, in order:

1. `tidy` — simplify and refine: reuse, dead code, naming, altitude.
2. `code-review` — find bugs, security issues, and rule violations.

tidy first so review sees the final shape; a review before tidy goes stale when
tidy moves the code. This is separate from the CI gate (`format:check` + `lint` +
`typecheck`), which still must pass.

## Gotchas

- Don't add a build step for shared packages — they're consumed as source.
- When adding a new workspace member under `packages/*` or `apps/*`, add a matching
  `COPY <path>/package.json ./<path>/` line to every Dockerfile that installs deps
  (`apps/api`, `apps/web`, `apps/worker`, `apps/bot`). The install stage
  copies manifests by an explicit list, so a missing one fails
  `bun install --frozen-lockfile` in the Docker build with
  `Workspace dependency "@repo/<name>" not found`, even though local dev works.
- Changing the better-auth config in `packages/auth` may change its tables → run
  `bun run auth:generate` then `bun run db:generate` + `db:migrate`.
- Frontend and backend on different domains in prod: adjust cookie `sameSite`/`secure`
  and `APP_URL` (see `packages/auth/AGENTS.md`).
- Tests run on `bun test` with Eden Treaty. Only `apps/api` has a suite so far; its
  setup and the rules for writing tests are in `apps/api/AGENTS.md`. They are
  integration tests against a real test Postgres (`.env.test`), not mocks.
- `bun --filter` needs the `=` form: `bun --filter='@repo/db' run <script>`. The space form
  `bun --filter <name> run <script>` matches no packages in Bun 1.3.9.

Per-package details are in each package's `AGENTS.md`.
