# AGENTS.md

It's a Plan, a self-hosted project tracker. Bun + Turborepo monorepo: Elysia api, Next.js (SSR)
web with shadcn/ui, better-auth, Drizzle + PostgreSQL.

Before you change files in an app or package, read its `AGENTS.md`: `apps/api`, `apps/web`,
`apps/worker`, `apps/bot`, `packages/auth`, `packages/db`. It overrides this file.

## Rules

- **KISS and YAGNI, no exceptions.** Write the simplest thing that works. Add an abstraction
  only when several concrete implementations need it.
- Study the existing code first and follow its patterns. Reuse shared modules, components and
  utilities. Extend them instead of adding a parallel solution.
- **Bun only.** `bun install`, `bun run`. Never npm, yarn, or pnpm. Run tasks from the repo root.
- All code, comments and strings are in English.
- Cross-package imports use the workspace protocol: `"@repo/db": "workspace:*"`. Packages export
  raw `.ts` and have no build step. `packages/runner` is the exception: it is published to npm,
  bundles to `dist/`, and its source uses no Bun APIs because the CLI runs on plain Node.
- The web app never imports a package. It calls the API over HTTP. Dependencies run
  `api → @repo/auth → @repo/db → @repo/crypto`.
- A server-side fetch of a supplied URL goes through `@repo/net`, the SSRF guard.
- Never skip the pre-commit hook with `--no-verify`. It runs `eslint --fix` and `prettier --write`.
- Minimum comments. A comment says why; the code says what. No comment longer than its code, none
  on layout or styling. Change or delete a comment in the same edit as its code. Full rules are
  in the `tidy` skill.

## When the work is done

Run on the new code, in this order, without being asked: `tidy`, `code-review`, `security-audit`.
Then propose a commit message in chat. Never run `git commit` or `git push` unless the user asks.

## Writing style (docs, comments, commits, chat)

- Plain, literal, short sentences. No metaphors, personification or drama. Bad: "data lives in
  Postgres", "self-healing queue". Good: "data is stored in Postgres", "a failed donor is retried
  on the next run". Standard terms (queue, pipeline, backlog, watermark) are fine.
- Write the final state, not the edit history. Do not write "not X, but Y", "previously",
  "moved from", "decided".
- Forward-looking rationale is allowed ("column `project_key` is added now so steps 3–4 need no
  migration"). A discarded idea appears only as a lasting "considered and rejected because…".

## Commands (from root)

| Command                   | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| `bun run dev`             | api, web, worker and bot in watch mode                    |
| `bun run typecheck`       | tsc in every workspace member, then at the root           |
| `bun run lint`            | ESLint across the workspace                               |
| `bun run format:check`    | Prettier check (CI runs the same)                         |
| `bun run test`            | `scripts/` tests, then every member's suite               |
| `bun run db:generate`     | generate SQL migrations from the Drizzle schema           |
| `bun run db:migrate`      | apply migrations                                          |
| `bun run db:migrate:test` | apply migrations to the test DB (`.env.test`)             |
| `bun run auth:generate`   | regenerate better-auth tables                             |

- One test file: `cd apps/api && bun test --env-file=../../.env.test <path>`. worker, bot and
  `packages/db` need the same flag. Packages without a database need no flag.
- `bun --filter` needs the `=` form: `bun --filter='@repo/db' run <script>`.
- Tests are integration tests against a real test Postgres, not mocks. api, bot, worker and
  `@repo/db` share one test database, and the api suite empties every table before each test, so
  those suites run one at a time.
- Do not add a workflow for a job `.github/workflows/ci.yml` already runs.

## Environment and deploy

- api, worker, bot, drizzle and docker-compose read the root `.env`. `apps/web` has its own `.env`:
  Next reads env only from its own folder.
- web reads `API_URL` and the legal document URLs from its process at startup. Never use
  `NEXT_PUBLIC_*` for them: `next build` inlines those, and the image then works for one instance.
- A new environment variable goes in `.env.example`. If a service needs it, also add it to
  `docker-compose.yml`, `docker-compose.pro.yml`, `docker-compose.coolify.yml`,
  `docker-compose.coolify-images.yml` and `docker-compose.coolify-pro.yml`.
- Add that variable to the Helm chart too: `values.yaml`, `templates/configmap.yaml` or
  `templates/secret.yaml`, and the values table in `charts/itsaplan/README.md`.
- A deploy stack change usually needs an edit in the same five compose files and the Helm chart.
- Never add `image:` to `docker-compose.coolify.yml`: with both `image:` and `build:` Coolify
  still builds and stops making rollback images.
- Run exactly one `bot` replica. It uses Telegram long polling.
- Migrations run as a separate step before the apps start. See `docs/dev/deploy-stack.md`.

## Commits

`type(scope): summary`. PRs are squash-merged, so the PR title becomes the commit subject, and
release-please reads it to pick the next version.

- `feat`: a capability that did not exist, one that earns a "Highlights" entry.
- `improvement`: a visible change to something that exists. Not a bug fix.
- `fix`: behaviour that was wrong is now right.
- `perf`, `refactor`, `docs`, `build`, `ci`, `test`, `chore`, `revert`: everything else.

Scope is the name of one app or package, none when the change spans several. Pick the type by what
the change gives the user. Version bumps and release config traps: `docs/dev/releasing.md`.

## Gotchas

- A new workspace member needs `COPY <path>/package.json ./<path>/` in every Dockerfile that
  installs deps (`apps/api`, `apps/web`, `apps/worker`, `apps/bot`). Without it the Docker build
  fails while local dev still works.
- A better-auth config change can change its tables. Run `bun run auth:generate`, then
  `db:generate` and `db:migrate`.
- Read the comments in `scripts/setup.ts` before you change it.

## Docs

Read the doc for what your task touches:

| Task touches                                  | Doc                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------- |
| local setup, running tests, the Docker gate   | `docs/development.md`                                                |
| who may do what: roles, workspaces, invites   | `docs/dev/access-model.md`                                           |
| AI agents, runs, traces, the runner queue     | `docs/dev/agents.md`                                                 |
| SCIM                                          | `docs/dev/scim.md`                                                   |
| sign-in methods, sessions, API keys, MCP OAuth | `docs/dev/auth.md`                                                  |
| live updates: scopes, counters, refetch       | `docs/dev/revision-engine.md`                                        |
| interface languages                           | `docs/dev/i18n.md`                                                   |
| imports                                       | `docs/dev/import-worker.md`, `docs/dev/{linear,trello,plane}-import.md` |
| migrations in deploys, backups                | `docs/dev/deploy-stack.md`                                           |
| commit types, versions, release config        | `docs/dev/releasing.md`                                              |
| self-hosting, Coolify, Railway, Helm          | `docs/self-hosting.md`, `docs/coolify.md`, `docs/railway.md`, `docs/helm.md` |
| the runner, external agents, MCP results      | `docs/runner.md`, `docs/agent-endpoint.md`, `docs/mcp-results.md`    |

## Changing an AGENTS.md

Read `docs/dev/agents-md.md` first. A line belongs here only if an agent would otherwise break a
rule it cannot see in the code. Do not add a line to record a fix or a feature. CI checks the
size limit and the references.
