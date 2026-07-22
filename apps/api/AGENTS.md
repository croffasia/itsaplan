# api (Elysia)

Elysia server on Bun, port 3000 (`API_PORT`). See root `AGENTS.md` for stack/env.
Rules and invariants for this package below; read the code for the walkthrough.

## Structure

- Feature-based: one folder per domain = `routes.ts` (controller) + `store.ts`
  (Drizzle service). Cross-cutting code in `shared/`. See `src/` for the current set.
- `app.ts` assembles and exports the app (`export const app`, no `.listen()`);
  `index.ts` only binds the port. `export type App = typeof app` types the Eden Treaty
  client (web + tests).
- `routes.ts`: `new Elysia({ name: "<feature>", detail: { tags: ["<Tag>"] } })` —
  routes chained directly on it, input validated with `t`, each route sets
  `detail.summary`.
- `store.ts`: plain async functions, no Elysia/HTTP types, returns DTOs never rows.

## Adding a route

- Chain on the same instance — never reassign to an intermediate `const` (breaks
  Elysia type inference and `type App`).
- Validate all input with `t`. Numeric path ids use `t.Numeric()`; never
  `Number(params.x)` in the handler.
- Enforce access with a guard in the route options, never an imperative call in the
  handler (see Auth and access).
- Throw `HttpError` for failures; return the store DTO on success; `noContent()` for a
  delete with no body; `set.status = 201` on create.
- New feature: `.use()` it in `planner.ts` and register its tag in the swagger
  `documentation.tags` list in `app.ts`.

## Error model

- Throw `HttpError(status, message)` for expected failures (400/404/409/413/502) —
  never hand-build error bodies. `onError` maps it to `{ error }`.
- Unique violation: wrap the insert in `rethrowDuplicate(err, "<what>")` → 409.
- `onError` also maps `t`-schema rejection → 400, `NOT_FOUND` → 404, anything else →
  500 logged with `[planner]`.

## Data invariants

- **DTOs, not rows.** `timestamptz` → `iso()` string; `numeric` → `num()`; `date` is
  already `'YYYY-MM-DD'`.
- **jsonb** (view `filters`/`display`, action `condition`/`effect`) passes through as
  JS objects — never `JSON.stringify`; validate only as `t.Any()`.
- **Sequence numbers** ("MKT-42") are issued under a row lock on `project` inside
  `createIssue`'s transaction — keep the lock so concurrent creates don't collide.
- **`position` is a sparse float** (`MAX(position) + 1000`); do not assume contiguous
  integers.
- **Deletes cascade in the DB** (every project/issue-scoped FK is `ON DELETE CASCADE`).
  `deleteIssue` still reads attachment rows first to purge their objects.
- **Object-store deletes are best-effort** — log a failed `deleteObject`, do not fail
  the request.

## Auth and access

Enforced declaratively through macros, never imperative calls in handlers.

- **Session:** `authContext` (named plugin) reads the better-auth session once, puts
  `user` on context, throws 401 with none. `planner.ts` gates every planner route;
  a feature also `.use(authContext)` when its handlers/macros reference `user`. An
  `x-api-key` header resolves through `getSession` — no special-casing.
- **Membership:** access is strictly by a `project_member` row (`owner` | `member`).
  Owners bypass the permission matrix; the global `user.role` (`god` | `user`) does
  **not**. Keep at least one owner per project.
- **`:projectKey` routes:** `.use(guards)` and set `permission: ["<resource>",
"<action>"]` / `projectMember: true` / `projectOwner: true`; read the resolved
  `project` from context.
- **Entity-by-id routes** (`/issues/:issueId`, `/views/:viewId`, …): define a local
  macro via `entityGuard(resource, notFound, resolveProjectId)` and set it in route
  options (e.g. `workItem: "edit"`). `GET /issues/:issueId` instead asserts
  `assertPermission` on the fetched row.
- Guards/macros wrap the `shared/access.ts` primitives. Handlers that still need
  `user` (project create, invite accept/reject, self-removal) call `requireUser(user)`.
- **Members join only through invites/**, not a direct add. One pending invite per
  (project, email) — partial unique index → 409. `members/` removes only (last owner
  protected).

## Security

- **`GET /attachments/:publicId/raw` is public and unauthenticated** (used in
  `<img>`/`<video>`). Preserve its defenses if you touch it: `X-Content-Type-Options:
nosniff`, forced download outside a strict media allowlist, locked-down CSP.

## Tests

`bun test` with **Eden Treaty** driving the app in memory against a real test Postgres
and real better-auth sessions — nothing is mocked. Import `app` via the helpers (from
`src/app.ts`), never `src/index.ts` (it binds the port).

**Setup.** Point tests at a dedicated `*_test` database, never dev/prod:

```bash
cp .env.test.example .env.test        # repo root; DATABASE_URL must name a *_test database
bun run db:migrate:test               # migrate it (repo root)
bun run test                          # from apps/api, or at root via turbo
```

The `test` script loads `--env-file=../../.env.test`. The attachments test also needs
MinIO + `S3_*` in `.env.test` (`docker compose -f docker-compose.dev.yml up -d` creates
the bucket); the Docker test gate starts its own throwaway MinIO.

**Layout.** Tests colocated under `__tests__/`, `integration/` (Treaty vs running app +
test DB, one file per feature) or `unit/` (pure functions, no session/HTTP/DB — import
directly). Helpers in `src/__tests__/helpers/`: `api` (anonymous client), `authedApi(cookie)`,
`signUpTestUser()` → `{ cookie, userId, email }`, `resetDb()`.

**Rules.**

- `beforeEach(resetDb)`. Build every precondition through the API, not raw inserts.
- Assert through the API (status + DTO via `toMatchObject`, side effects via a
  follow-up read), never by reading rows.
- Cover per route: happy path, one valid + one invalid per field rule, boundaries
  (empty, max/max+1, last-owner), each failure status (400/403/404/409), and the
  feature's own access wiring (owner succeeds, non-member 403). Don't re-test shared
  machinery — the no-session 401 and the permission matrix have their own tests in
  `shared/__tests__/`.
- Confirm each case goes red when the behavior is broken.

**Gotchas.**

- Assert failures on the top-level `status`, not `error.status` — Treaty narrows
  `error.status` (e.g. `422`), so `HttpError` codes (400/401/403/404) fail typecheck
  there. Read the body from `error.value`.
- A DTO date arrives as a `Date`, not a string — Treaty revives `iso()` strings on the
  client. Assert the value, not `typeof === "string"`.
- The first `signUpTestUser` in a test is `god` (fresh DB per `resetDb`). To act as a
  plain user, create the god user first and act as the second.
- Don't hardcode ids or the "-42" sequence — read them from the create response.

## Rules

- Auth logic is in `@repo/auth`, DB access via `@repo/db` — do not re-instantiate
  either. The web app never imports these packages; it uses this API over HTTP.
- CORS `origin` is the `trustedOrigins` list exported by `@repo/auth` — do not re-parse
  `APP_URL` here.
- swagger `/docs` (planner) is separate from better-auth's `/api/auth/reference`; both
  stay reachable without a session.
- Dev: `bun run dev`. Prod: the Dockerfile migrates, then starts the server.
