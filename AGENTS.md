# AGENTS.md

Bun + Turborepo monorepo. Backend **Elysia**, frontend **Next.js (SSR)** + **shadcn/ui**,
auth **better-auth**, ORM **Drizzle** + PostgreSQL. Self-hosted with Docker Compose or the
Helm chart.

The most specific `AGENTS.md` for the changed area overrides this file. Every app and some
packages have one. Each `CLAUDE.md` only points to the `AGENTS.md` next to it.

## Editing this file

This file holds only the core rules that an agent needs on most tasks.

- Do not add a fix, a feature description, or a detail that only one area needs. Put it in a
  code comment, in `docs/`, or in the `AGENTS.md` of that app or package.
- Add a rule here only when the user asks.

## Core Coding Principles

- **IMPORTANT — always follow, no exceptions:** KISS and YAGNI. Write the simplest thing that
  works. Add an abstraction only when several concrete implementations need it. No
  overengineering.
- Study the existing code first and follow its sound patterns and conventions. Reuse shared
  modules, components, and utilities. Extend them instead of adding a parallel solution.
- Minimum comments. A comment explains why, the code explains what. Hide the comment and
  read the code: if the code tells the fact, delete the comment.
  - A comment longer than its code is too long.
  - A wrong comment is worse than none. Change or delete a comment in the same edit as its code.
  - Do not copy the comment density of nearby code. This rule wins.
  - Never comment layout or styling: positioning, sticky or overflow behaviour, spacing, why a
    class is set.
  - The full rules and the pass that removes stale comments are in the `tidy` skill.

## When the work is done

Run on the new code, in this order, without being asked:

1. `tidy`
2. `code-review`
3. `security-audit`

Then propose a commit message in chat (format in [Commits](#commits)). Never run
`git commit` or `git push` unless the user asks.

## Writing style (docs, comments, chat)

Applies to all prose: docs, code comments, commit messages, chat replies.

- Write plainly and literally, in short, direct sentences.
- No metaphors, personification, or figurative language. Bad: "the parser is the heart of the
  step", "data lives in Postgres", "self-healing queue", "the ticket flows through the
  pipeline". Good: "the parser is the main task of the step", "data is stored in Postgres",
  "a failed donor is retried on the next run".
- No rhetorical flourishes or drama. Say what a thing does, not how important or elegant it is.
- Standard terms that began as metaphors (watermark, backlog, queue, pipeline) are fine.

**Write the final state, not the edit history.** When the user changes a decision, rewrite
docs and comments to describe only the current design.

- Do not write "not X, but Y", "now in the DB instead of in code", "decided", "moved from a
  separate step", "previously we planned". Write Y.
- Do not explain why a choice replaced an earlier idea from the conversation.
- Allowed: forward-looking rationale ("column `project_key` is added now so steps 3–4 need no
  migration") and cross-references between sections.
- Mention a discarded idea only as a lasting "considered and rejected because…" that a future
  reader would otherwise propose again. State it once, plainly.

## Golden rules

- **Runtime is Bun.** Never npm, yarn, or pnpm. Use `bun install` and `bun run`.
- **All code, comments, and strings are in English.**
- Cross-package imports use the workspace protocol: `"@repo/db": "workspace:*"`. Packages
  export raw `.ts` (see each package's `exports`). Bun and Next transpile them. No build step.
- Run tasks from the **repo root** through Turborepo: `bun run dev` / `build` / `typecheck`.
- The pre-commit hook (`lefthook.yml`) runs `eslint --fix` and `prettier --write` on the
  staged files and stages the result again. Never skip it with `--no-verify`.

## Layout

```
apps/api               Elysia (Bun) — better-auth at /api/auth/*, agent runs         :3000
apps/web               Next.js App Router, SSR (not SPA) + shadcn + TanStack Query  :3001
apps/worker            webhook and notification delivery, agent schedules, imports
apps/bot               Telegram bot, long polling
packages/db            @repo/db          — Drizzle client, schema, migrations, permission matrix, shared config readers
packages/auth          @repo/auth        — better-auth server instance + instance auth settings
packages/crypto        @repo/crypto      — AES-256-GCM encryption for secrets at rest
packages/storage       @repo/storage     — S3 client (RustFS in Compose) for attachment bytes, used by api and worker
packages/mailer        @repo/mailer      — SMTP/Resend transport for outbound email
packages/net           @repo/net         — SSRF guard for server-side fetches of a supplied URL
packages/agent-tools   @repo/agent-tools — tool definitions for the AI agent runtime
packages/runner        @itsaplan/runner  — CLI that runs an external agent's queued tasks on the operator's own machine
packages/eslint-config @repo/eslint-config — shared ESLint config
charts/itsaplan        Helm chart
scripts/               `bun run setup` and its tests
dev-scripts/           dev-stack.sh (switch dev/PR backing services), permission-matrix.sh (permission → route table)
docs/                  see Docs below
```

Dependency graph: `api → @repo/auth → @repo/db → @repo/crypto`. **The web app never imports
packages directly.** It talks to the API over HTTP (better-auth client + fetch).

## Docs

| Doc                                                                                                 | Read when the task touches                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `docs/development.md`                                                                               | local setup, `bun run setup`, running tests, the Docker test gate |
| `docs/self-hosting.md`                                                                              | the self-hosting compose stack, `.env` for a domain, TLS proxy   |
| `docs/coolify.md`                                                                                   | `docker-compose.coolify*.yml`                                    |
| `docs/railway.md`                                                                                   | the Railway template                                             |
| `docs/helm.md`, `charts/itsaplan/README.md`                                                         | the Helm chart and its values                                    |
| `docs/runner.md`                                                                                    | `packages/runner` and its agent presets                          |
| `docs/agent-endpoint.md`                                                                            | external agents that receive tasks on their own HTTPS endpoint   |
| `docs/mcp-results.md`                                                                               | the shape of MCP tool results (`structuredContent`)              |
| `docs/importing-from-linear.md`, `docs/dev/linear-import.md`                                        | the Linear import: user guide, implementation                    |
| `docs/importing-from-plane.md`, `docs/dev/plane-import.md`, `docs/dev/plane-import-source-notes.md` | the Plane import: user guide, implementation, Plane API facts    |
| `docs/dev/revision-engine.md`                                                                       | live updates: scopes, counters, refetch                          |
| `docs/dev/i18n.md`                                                                                  | interface languages, the language cookie                         |

## Commands (from root)

| Command                   | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `bun run dev`             | api, web, worker and bot in watch mode (turbo)                     |
| `bun run build`           | build all apps                                                     |
| `bun run typecheck`       | tsc in every workspace member, then at the root                    |
| `bun run lint`            | ESLint across the workspace                                        |
| `bun run format:check`    | Prettier check (CI runs the same)                                  |
| `bun run test`            | `scripts/` tests, then every member's suite, one package at a time |
| `bun run db:generate`     | generate SQL migrations from Drizzle schema                        |
| `bun run db:migrate`      | apply migrations                                                   |
| `bun run db:migrate:test` | apply migrations to the test DB (`.env.test`)                      |
| `bun run db:studio`       | Drizzle Studio on the dev DB                                       |
| `bun run setup`           | interactive local setup (see `docs/development.md`)                |
| `bun run auth:generate`   | regenerate better-auth tables → `packages/db/src/schema/auth.ts`   |

One test file: `cd apps/api && bun test --env-file=../../.env.test <path>`. worker, bot and
`packages/db` need the same flag. Packages without a database need no flag.

CI (`.github/workflows/ci.yml`) runs on every pull request: `format:check`, `lint`,
`typecheck`, an app build, and the Docker test gate (`docker-compose.test.yml`). Do not add a
workflow for a job that an existing workflow already runs.

## Environment

- api, worker, bot, drizzle, and docker-compose read the root `.env` (a copy of
  `.env.example`). Bun apps load it with `--env-file=../../.env`. Drizzle loads it with `dotenv` in
  `drizzle.config.ts`.
- `apps/web/.env` is **separate**: Next reads env only from its own folder. It holds
  `API_URL` (same value as the root one) and the legal document URLs. web reads them from its
  process at **startup**. Never use `NEXT_PUBLIC_*` for them: `next build` inlines those into
  the bundle, and the image then works for one instance only.
- Add a new environment variable to `.env.example`. If a service needs it, also add it to the
  five deploy compose files and to the Helm chart: `values.yaml`,
  `templates/configmap.yaml` or `templates/secret.yaml`, and the values table in
  `charts/itsaplan/README.md`.

## Deploy stack

- `docker-compose.dev.yml` holds only the local backing services (Postgres + RustFS). The apps
  run on the host. The deploy composes do NOT publish the DB port.
- A deploy stack change usually needs an edit in **all five** of `docker-compose.yml`,
  `docker-compose.pro.yml`, `docker-compose.coolify.yml`, `docker-compose.coolify-images.yml`,
  `docker-compose.coolify-pro.yml`, and in the Helm chart.
- `docker-compose.pro.yml` and `docker-compose.coolify-pro.yml` run the published Pro
  images: migrate from `vendor/itsaplan/packages/db/src/migrate.ts`, start the api with
  `./pro-api`. The Helm chart does the same when `pro: true` (`values-pro.yaml`).
- Never add `image:` to `docker-compose.coolify.yml`. With both `image:` and `build:` Coolify
  still builds and stops making rollback images.
- Migrations run as a separate step before the apps start:
  - Compose: the one-shot `migrate` service. api, worker and bot wait for it.
  - Helm: the `migrate` init container of the api pods. Worker and bot pods wait in a
    `wait-for-migrations` init container.
  - Both run `migrate.ts` from the api image and override the api command, so the api
    container only starts the server.
- The api image's own CMD also runs the migrations before the server starts. Deploy targets
  with no separate step (Railway, a plain `docker run`) need this.
- `migrate.ts` first dumps the database into the `db-backups` volume. A failed dump stops the
  run, so no migration runs without a backup. Every run takes a Postgres advisory lock, so
  runs that start together apply each migration only once.
- Run exactly one `bot` replica: it uses Telegram long polling.

## Commits

Subject: Conventional Commit, `type(scope): summary`. PRs are squash-merged, so the PR title
becomes the commit subject on `main` (`pr-title.yml` checks it). release-please reads the
subjects to pick the next version and write `CHANGELOG.md`.

Pick the type by what the change gives the user, not by how much code it touches:

- **`feat:` — minor.** A capability that did not exist: a new entity, page, integration, or a
  setting that unlocks behaviour. Use it only for a change that earns a "Highlights" entry.
- **`improvement:` — patch.** A visible change to something that exists: a redesign, a
  reworked layout, a theme, a better interaction. Not a bug fix, not a new capability.
- **`fix:` — patch.** Behaviour that was wrong is now right.
- **Every other type (`perf`, `refactor`, `docs`, `build`, `ci`, `test`, `chore`, `revert`) —
  patch.**

Scope: the name of one app or package (`api`, `web`, `worker`, `bot`, `db`, `auth`, …). No
scope when the change spans several.

While the version is `0.x`, `!` (e.g. `feat!:`) bumps the minor. The major never bumps
automatically. To cut `1.0.0`, add a `Release-As: 1.0.0` footer to the squash commit body.

Release config traps:

- Add a new commit type to both `pr-title.yml` and `changelog-sections` in
  `release-please-config.json`. release-please drops a type that is not in
  `changelog-sections` from the release notes.
- Keep `"package-name": ""` in `release-please-config.json`. Without it, release-please skips
  every release and stops at `There are untagged, merged release PRs outstanding - aborting`.

## Gotchas

- Shared packages have no build step. Their consumers import the source. The exception is
  `packages/runner`, the only member published to npm. It bundles to `dist/`
  (`bun build --target=node`), and its source uses no Bun APIs because the published CLI runs
  on plain Node. Publish it by hand (`npm publish` after a `version` bump). release-please
  versions the application, not this package.
- New workspace member under `packages/*` or `apps/*`: add `COPY <path>/package.json ./<path>/`
  to every Dockerfile that installs deps (`apps/api`, `apps/web`, `apps/worker`, `apps/bot`).
  The install stage copies manifests from an explicit list. A missing line fails
  `bun install --frozen-lockfile` in the Docker build with
  `Workspace dependency "@repo/<name>" not found`, while local dev still works.
- A better-auth config change in `packages/auth` can change its tables. Run
  `bun run auth:generate`, then `bun run db:generate` and `db:migrate`.
- Frontend and backend on different domains in prod: adjust cookie `sameSite`/`secure` and
  `APP_URL` (see `packages/auth/AGENTS.md`).
- Tests use `bun test`. They are integration tests against a real test Postgres
  (`.env.test`), not mocks. `apps/api` uses Eden Treaty. Its setup and test-writing rules are
  in `apps/api/AGENTS.md`. api, bot and worker share one test database, and the api suite
  truncates every table before each test. So the suites never run in parallel
  (`--concurrency=1`).
- `bun --filter` needs the `=` form: `bun --filter='@repo/db' run <script>`. With the space
  form, Bun reads `run` as the script name and fails.
- Read the comments in `scripts/setup.ts` before you change it. They give the rules that keep
  the script safe to run again on a live instance.
