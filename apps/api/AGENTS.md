# api (Elysia)

Elysia server on Bun, port 3000 (`API_PORT`). See root `AGENTS.md` for stack/env.
Rules and invariants for this package below; read the code for the walkthrough.

## Structure

- Feature-based: one folder per domain under `src/modules/`, three files —
  `index.ts` (controller), `model.ts` (schemas), `service.ts` (Drizzle). Cross-cutting
  code in `shared/`. See `src/modules/` for the current set.
- Features nest one level deeper only where they already call each other:
  `modules/agents/{core,chat,runner,schedules,skills,tools}`, where `core` holds the
  agent itself and its runtime. A feature whose links to its neighbours run one way
  stays flat. A schema several of the nested features share sits in the parent's
  `model.ts` and is re-exported from each child's (`agentParams`).
- `src/app.ts` assembles and exports the app (`export const app`, no `.listen()`);
  `src/index.ts` only binds the port. `export type App = typeof app` types the Eden
  Treaty client (web + tests).
- `index.ts`: `new Elysia({ name: "<feature>", detail: { tags: ["<Tag>"] } })` —
  routes chained directly on it, each route sets `detail.summary`. Handlers only;
  the schemas they reference come from `model.ts`.
- `model.ts`: the `t` schemas of the feature's requests and responses. An update body
  is `t.Partial(<create body>)` where it accepts the same fields.
- `service.ts`: plain async functions, no Elysia/HTTP types, returns DTOs never rows.
- Every feature lives under `src/modules/`. A feature that needs more than the three
  files adds one per concern next to them (`emit.ts`, `internal-routes.ts`), it does
  not grow a `routes.ts` + `store.ts` pair.
- Imports inside a module are relative (`./model`); everything it reaches outside
  itself goes through the subpath aliases in `apps/api/package.json` — `#shared/*`,
  `#mcp/*`, `#modules/*`, `#tests/*`. They map to a `.ts` file (`"#shared/*":
"./src/shared/*.ts"`), which is what makes both `tsc` and Bun resolve them, and they
  resolve against the api's own `package.json`, so they hold in the Docker image where
  the process starts from the repo root. A tsconfig `paths` alias would not: there is
  no tsconfig.json at that root.

## Adding a route

- Chain on the same instance — never reassign to an intermediate `const` (breaks
  Elysia type inference and `type App`).
- Validate all input with `t`, from a schema declared in the feature's `model.ts`.
  Numeric path ids use `t.Numeric()`; never `Number(params.x)` in the handler.
- Enforce access with a guard in the route options, never an imperative call in the
  handler (see Auth and access).
- Throw `HttpError` for failures; return the service DTO on success; `noContent()` for a
  delete with no body; `set.status = 201` on create.
- New feature: `.use()` it in `planner.ts` and register its tag in the swagger
  `documentation.tags` list in `app.ts`.

## Error model

- Throw `HttpError(status, message)` for expected failures (400/404/409/413/502) —
  never hand-build error bodies. `onError` maps it to `{ error }`.
- Unique violation: wrap the insert in `rethrowDuplicate(err, "<what>")` → 409.
- `onError` also maps `t`-schema rejection → 400, `NOT_FOUND` → 404, anything else →
  500 logged with `[planner]`.
- A route declares the statuses it can fail with by spreading a map from
  `shared/responses.ts` into its `response`: `accessErrors` (401/403/404) for a
  guarded read, `commonErrors` (+400) where it also validates input, `errors(...)` for
  anything else (`{ ...commonErrors, ...errors(409) }`). Listing the codes per route is
  what puts them in the OpenAPI docs — a `guard({ schema: "standalone", response })`
  on the feature passes typecheck but drops them from the spec.

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
- **Members join through invites or a provisioned group**, never a direct add from
  `members/`. One pending invite per (project, email) — partial unique index → 409.
  `members/` removes only (last owner protected). `project_member.source` says which path
  a row came from: `modules/scim/reconcile.ts` only ever writes, re-roles or removes its own
  `'scim'` rows, and `members/` refuses to edit or remove one (409) because the next sync
  would undo the change.

## SCIM

`modules/scim/` serves SCIM 2.0 (RFC 7643 / 7644) at `/scim/v2` for an identity provider
to provision users and groups with. Three things make it unlike every other module:

- **Mounted on the root app in `app.ts`, not under `planner`.** The planner's `authContext`
  answers 401 before the bearer check could run. Authentication is one `onBeforeHandle`
  against the instance SCIM token from `@repo/auth`.
- **Its own error document.** `onError` sits on a parent instance that `.use()`s the routes
  and answers only for paths under `/scim/v2`, handing everything else back to the planner's
  handler. Two reasons for that shape: an `onError` beside the routes widens the inferred
  response type of every one of them with the body it returns (which then reaches the Eden
  client as a success shape), and Elysia propagates the handler to the root app either way.
- **Bodies are `t.Any()`.** SCIM defines its own schemas and clients send attributes this app
  ignores, so `resource.ts` validates instead and raises `ScimError`, which carries the
  `scimType` a provisioning client branches on. Responses are declared per route from
  `model.ts` — `scimErrors(...)` is the SCIM-shaped counterpart of `shared/responses.ts`.

Filtering is `<attribute> eq "<value>"` only, over the attributes each resource lists in
`service.ts`; that is what Okta, Entra and Authentik send, and `ServiceProviderConfig`
advertises exactly that. A create inserts the `user` row directly, the way `createAgent`
does, which deliberately skips the registration gate — with SCIM on, the identity provider
decides who exists, and that is what makes `registration: 'closed'` plus SSO work.

`createScimUser`/`updateScimUser` refuse a `god`-role account outright (409): the role is
what grants god mode, and nothing about the instance owner's account is provider-owned. A
create for an address already linked (`user.scimExternalId` set) is refused the same way —
it is a retry, not a new person, and must not overwrite the link a first create wrote.

A group member removal arrives in two shapes: `path: 'members'` with the id(s) to drop in
`value`, or RFC 7644 §3.5.2.2's path filter, `path: 'members[value eq "<id>"]'`, which Okta
sends and which carries no `value` at all. `resource.ts`'s `memberFilterIds` reads the
second shape; a `PATCH /Groups/:id` remove that only checked `value` would silently drop
nothing for a provider that sends the filter form.

The `scim_group` / `scim_group_member` tables have two writers, not one. A SCIM sync is
the obvious one, but a group can also be embedded right on a resource instead of pushed on
its own: `resource.ts`'s `groupDisplayNames` reads a SCIM User's `groups` attribute, and
`oidc-sync.ts` reads an OIDC sign-in's `groups` claim off the ID token stored on the linked
`account` row, decoded with no signature check since it already crossed a trusted, TLS
channel and is read only for a claim, not for authentication. Both funnel into
`syncEmbeddedGroups`, the same additive-only join a group pushed through `POST /Groups`
gets — a name missing from a later sync is never removed by this path, only by an explicit
`PATCH /Groups/:id` or an unmapping in god mode.

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
