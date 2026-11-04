# api (Elysia)

| Before you change                                        | Read                       |
| -------------------------------------------------------- | -------------------------- |
| roles, workspaces, invites, members, who may do what     | `docs/dev/access-model.md` |
| agents, runs, traces, analytics, runner queue, MCP reach | `docs/dev/agents.md`       |
| SCIM                                                     | `docs/dev/scim.md`         |
| test setup, parallel workers                             | `docs/dev/api-tests.md`    |

## Structure

- One folder per domain under `src/modules/`, three files: `index.ts`, `model.ts`, `service.ts`.
  Cross-cutting code is in `shared/`.
- `index.ts`: `new Elysia({ name: "<feature>", detail: { tags: ["<Tag>"] } })`, routes chained
  directly on it, each route sets `detail.summary`, handlers only.
- `model.ts`: the `t` schemas. An update body is `t.Partial(<create body>)` where it accepts the
  same fields.
- `service.ts`: plain async functions, no Elysia/HTTP types, returns DTOs never rows.
- A feature that needs more adds one file per concern next to them (`emit.ts`, `run-queue.ts`),
  never a routes file plus a store file. Features nest only where they already call each other
  (`modules/agents`).
- Imports inside a module are relative (`./model`). Everything outside goes through the subpath
  aliases in `apps/api/package.json`: `#shared/*`, `#mcp/*`, `#modules/*`, `#tests/*`.
- `src/app.ts` exports the app, no `.listen()`. `src/index.ts` binds the port and starts
  `src/background.ts`. Start background jobs from `index.ts`, never from the app, so importing the
  app in a test starts nothing. A background job must be safe with several api replicas.

## Adding a route

- Chain on the same instance. A route added in a separate statement that drops the return value
  is missing from Elysia's type inference and from `type App`.
- Validate all input with `t`, from a schema declared in the feature's `model.ts`. Numeric path
  ids use `t.Numeric()`; never `Number(params.x)` in the handler.
- Enforce access with a guard in the route options. Only a rule no guard can express stays in the
  handler, such as a list across projects or a private view: see `requiresPermission` below.
- Throw `HttpError` for failures; return the service DTO on success; `noContent()` for a delete
  with no body; `set.status = 201` on create.
- New feature: `.use()` it in `planner.ts` and register its tag in the swagger
  `documentation.tags` list in `app.ts`.

## Error model

- Throw `HttpError(status, message)` for expected failures. Never hand-build error bodies.
  `onError` maps it to `{ error }`, plus `code` when the `HttpError` has one.
- Unique violation: wrap the insert in `rethrowDuplicate(err, "<what>")` → 409.
- A route declares its failure statuses by spreading a map from `shared/responses.ts` into its
  `response`: `accessErrors` (401/403/404) for a guarded read, `commonErrors` (+400) where it also
  validates input, `errors(...)` for anything else (`{ ...commonErrors, ...errors(409) }`).
- Set that map per route. A `guard({ schema: "standalone", response })` on the feature passes
  typecheck but drops the codes from the OpenAPI spec.

## Data invariants

- **DTOs, not rows.** `timestamptz` → `iso()` string; `numeric` → `num()`; `date` is already
  `'YYYY-MM-DD'`.
- **jsonb** passes through as JS objects. Never `JSON.stringify`; validate only as `t.Any()`.
- **Sequence numbers** ("MKT-42") are issued under a row lock on `project` inside the transaction
  of `createIssue` and of `moveIssue`. Keep the lock. A moved issue's old number goes to
  `issue_key_alias`, and the counter never goes back.
- **The `position` step differs by table.** `issue`, `initiative` and checklists are sparse floats
  (`MAX(position) + 1000`). Columns, issue types, custom fields, views, dashboards and actions
  step by 1. Never assume contiguous values.
- **A delete relies on the FK actions.** A row that cannot exist without its parent uses `cascade`;
  an optional link (assignee, author, cycle, parent issue) uses `set null`. `deleteIssue` still
  reads attachment rows first to purge objects.
- **Object-store deletes are best-effort**: log a failed `deleteObject`, do not fail the request.
- **A list route either pages or answers with the whole list, never both.** A list a picker needs
  entire gets an `/options` route returning a plain array. A whole-list read only the server needs
  is a service function of its own.
- A paged route takes `...pageQueryFields`, answers with `pageResponse(...)` and wraps its service
  in `paginate` (`shared/pagination.ts`). The service takes a required `{ limit, offset }` and
  returns `{ items, total }`.
- **A feed pages by cursor**: `limit` + `cursor`/`before` → `{ items, nextCursor }`. Rows arrive
  at its head while a reader is paging. Everything else uses `page`/`pageSize`.

## Auth and access

Enforced through macros in the route options.

- **`:projectKey` routes:** `.use(guards)` and set `permission: ["<resource>", "<action>"]`,
  `projectMember: true` or `projectOwner: true`; read `project` from context.
- **Entity-by-id routes** (`/issues/:issueId`): define a local macro with
  `entityGuard(resource, notFound, resolveProjectId)` and set it in the route options
  (`workItem: "edit"`).
- **Team-owned resources** (agents, skills, tools, integrations) are under `:teamId` with the
  `teamPermission` guard. What happens in one project (chat, runs, schedules) stays under
  `:projectKey`.
- A route that resolves the project itself calls `assertMcpAllowed`, as `entityGuard` does. A
  handler that checks a permission itself spreads `requiresPermission([...])` into its `detail`,
  so the MCP tool table still reports what it requires.
- A feature also `.use(authContext)` when its handlers or macros reference `user`. Handlers that
  still need `user` call `requireUser(user)`. An `x-api-key` header resolves through `getSession`,
  so no route special-cases it.
- Owners bypass the permission matrix; the global `user.role` (`god` | `user`) does **not**. Keep
  at least one owner per project.
- Whether _the caller_ may reach something goes through `getProjectAccess` / `getTeamAccess`.
  Whether _someone else_ is a member (assignees, mentions, recipients, seats, last-owner) reads
  the rows, so a workspace manager is in no member list.
- Member routes use `memberAdmin` or `memberSelfOrAdmin`. Granting `owner`, or a role with a
  `roleId`, is capped: `assertProjectAdmin`, `mayGrantInviteRanks`, `assertGrantablePermissions`.
- An invite is checked against its sender when made and again when accepted.
- An agent is never a project owner. An action on an agent that reaches every project it works in
  takes `assertFullAgentAccess`. There is no instance-level agent and no non-human flag on `user`.
- A `project_member` row with `source: 'scim'` is refused for edit or removal (409), because the
  next sync would undo the change.
- A `team_member` row is refused for removal or leaving only while its `source` is `'scim'` and its
  role is `member`. Its rank can be changed, and the sync then leaves the row alone.
- `GET /attachments/:publicId/raw` is public. Keep `X-Content-Type-Options: nosniff`, forced
  download outside a strict media allowlist, and the locked-down CSP.

## Tests

`bun test` with Eden Treaty driving the app in memory against a real test Postgres and real
better-auth sessions. Nothing is mocked. Import `app` via the helpers, never `src/index.ts`.

- Tests are colocated under `__tests__/`: `integration/` or `unit/`. Helpers are in
  `src/__tests__/helpers/`: `api`, `authedApi(cookie)`, `signUpTestUser()`, `resetDb()`.
- `beforeEach(resetDb)`. Build every precondition through the API. Write to the DB only for a
  state the API cannot produce, such as a retry that is due now.
- Assert through the API (status + DTO via `toMatchObject`, side effects via a follow-up read).
  Read rows only for what no route returns, such as a queued run or a stored ciphertext.
- Cover per route: happy path, one valid + one invalid per field rule, boundaries (empty, max/max+1,
  last-owner), each failure status, and the feature's own access wiring (owner succeeds, non-member
  403). Do not re-test the no-session 401 or the permission matrix.
- Confirm each case goes red when the behavior is broken.
- Assert failures on the top-level `status`, not `error.status`: Treaty narrows it, so `HttpError`
  codes fail typecheck there. Read the body from `error.value`.
- A DTO date arrives as a `Date`: Treaty revives `iso()` strings. Assert the value.
- The first `signUpTestUser` in a test is `god`. To act as a plain user, create the god user first
  and act as the second.
- Do not hardcode ids or the "-42" sequence. Read them from the create response.
- A test that runs an internal agent against a model must flush its spans before it ends:
  `await getMastra().observability.flush()`. Late spans count as the next test's runs.

## Rules

- Auth logic is in `@repo/auth`, DB access via `@repo/db`. Do not re-instantiate either.
- A state-changing request with the session cookie must come from a trusted origin; the
  `onRequest` guard in `app.ts` refuses the rest with 403 `CSRF_ORIGIN_REJECTED`.
