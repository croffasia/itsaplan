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
  `src/index.ts` binds the port and starts `src/background.ts`.
  `export type App = typeof app` types the Eden Treaty client (web + tests).
- **Background jobs are started from `index.ts`, never assembled into the app**, so
  importing the app in a test starts nothing. `background.ts` drains the `agent_run`
  queue in one loop and runs the auto-archive sweep in a loop of its own, so neither
  waits on the other. Several api replicas run them without overlapping: the queue is
  claimed with `FOR UPDATE SKIP LOCKED`, and the sweep only touches rows it has not
  archived yet. An agent run is built from the queue row alone — the project it works
  in and the bot user it acts as are read there, never handed in.
- `index.ts`: `new Elysia({ name: "<feature>", detail: { tags: ["<Tag>"] } })` —
  routes chained directly on it, each route sets `detail.summary`. Handlers only;
  the schemas they reference come from `model.ts`.
- `model.ts`: the `t` schemas of the feature's requests and responses. An update body
  is `t.Partial(<create body>)` where it accepts the same fields.
- `service.ts`: plain async functions, no Elysia/HTTP types, returns DTOs never rows.
- Every feature lives under `src/modules/`. A feature that needs more than the three
  files adds one per concern next to them (`emit.ts`, `run-queue.ts`), it does
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
  the transaction of `createIssue` and of `moveIssue` (`issues/move.ts`) — keep the
  lock so concurrent writes don't collide. A moved issue's old number goes to
  `issue_key_alias`, and `getIssueBySequence` resolves it to the issue in its new
  project. The counter never goes back, so an alias never collides with an issue.
- **`position` is a sparse float** (`MAX(position) + 1000`); do not assume contiguous
  integers.
- **Deletes cascade in the DB** (every project/issue-scoped FK is `ON DELETE CASCADE`).
  `deleteIssue` still reads attachment rows first to purge their objects.
- **Object-store deletes are best-effort** — log a failed `deleteObject`, do not fail
  the request.
- **A list route either pages or answers with the whole list, never both.** A paged
  route takes `...pageQueryFields` (`page`/`pageSize`, 25 by default), answers with
  `pageResponse(...)` and wraps its service in `paginate` (`shared/pagination.ts`); its
  service takes a required `{ limit, offset }` and returns `{ items, total }`, counted
  beside the window so a page past the end still reports how many there are. A list a
  picker needs entire gets an `/options` route of its own returning a plain array
  (`/teams/:teamId/agent-skills/options`), and a whole-list read only the server needs
  is a service function of its own (`listAllAgentSchedules`). A query flag that
  switches one route between the two makes every caller check which it got.
- **A feed pages by cursor, not by offset**: `limit` + `cursor`/`before` →
  `{ items, nextCursor }`. Rows arrive at its head while a reader is paging, which
  makes an offset skip or repeat them. Everything else uses `page`/`pageSize`, whether
  the screen shows numbered pages or a "show more" button.

## Auth and access

Enforced declaratively through macros, never imperative calls in handlers.

- **Session:** `authContext` (named plugin) reads the better-auth session once, puts
  `user` on context, throws 401 with none. `planner.ts` gates every planner route;
  a feature also `.use(authContext)` when its handlers/macros reference `user`. An
  `x-api-key` header resolves through `getSession` — no special-casing. A route outside
  the planner that answers without credentials (`/me`) reads the same account through
  `requestUser`, which also takes the MCP OAuth token of a tool call.
- **Membership:** access is by a `project_member` row (`owner` | `member`), raised by
  the caller's role in the workspace that holds the project. Owners bypass the
  permission matrix; the global `user.role` (`god` | `user`) does **not**. Keep at least
  one owner per project.
- **Workspace roles reach every team and project of the workspace** without a membership
  row: the owner as an owner of each, an admin with a matrix that only reads. The table
  is `shared/workspace-roles.ts`; `setWorkspaceRoleGrant(role, grant)` changes what a role
  grants or adds a role, for a build that has more. `getProjectAccess` and
  `getTeamAccess` in `shared/access.ts` merge the membership with the grant, and every
  guard reads them. The lists that decide what the caller sees — `listProjects`, the
  team list, `readRevs` — take the reached teams the same way, and answer `via:
'workspace'` for what the caller reaches only through the workspace. Everything that
  asks whether _someone else_ is a member — assignees, mentions, watchers, notification
  recipients, seats, the last-owner check, SCIM — still reads the rows, so a workspace
  manager is in none of the member lists, gets no notifications and takes no seat.
- **`:projectKey` routes:** `.use(guards)` and set `permission: ["<resource>",
"<action>"]` / `projectMember: true` / `projectOwner: true`; read the resolved
  `project` from context.
- **Entity-by-id routes** (`/issues/:issueId`, `/views/:viewId`, …): define a local
  macro via `entityGuard(resource, notFound, resolveProjectId)` and set it in route
  options (e.g. `workItem: "edit"`). `GET /issues/:issueId` instead asserts
  `assertPermission` on the fetched row, and spreads `requiresPermission([...])` into its
  `detail` so the MCP tool table still reports what it requires. `GET
/projects/:projectKey/issues/:sequenceNumber` does the same for an old number that
  resolved to an issue now in another project. `POST /issues/:issueId/move` checks the
  target project in the `moveTarget` macro, which reads `projectId` from the body.
- Every guard publishes the pair it asserts as `x-permission` on the route's OpenAPI
  detail, which is where `mcp/generate.ts` reads it — Elysia deletes a macro's own key
  from the route once it expands the macro, so there is nothing else to read it from.
- Guards/macros wrap the `shared/access.ts` primitives. Handlers that still need
  `user` (project create, invite accept/reject, self-removal) call `requireUser(user)`.
- **The workspace decides who creates a team in it** (`POST /teams`, `createTeam` in
  `teams/service.ts`, `assertMayCreateTeam` in `workspaces/service.ts`): its owner by
  default, also its admins, or anyone in one of its teams, as its owner sets
  `teamCreation`. `workspaceId` in the body names the workspace and is required. Anyone
  else gets 403.
- **Every person owns one workspace.** No route creates one: sign-up makes it
  (`@repo/auth`), and `authContext` makes it on the next request for an account that has
  none (`ensurePersonalWorkspace`): the instance owner always, anyone else while
  `personalWorkspaces` is on in the auth settings. There is no shared workspace; every
  team is in the workspace of its owner.
  A build that lets a person own more mounts its own route on `createOwnWorkspace` and
  `workspaceCreation` (`workspaces/service.ts`, which refuse an agent's bot user) and
  raises the number with `setOwnedWorkspaceLimit` (`shared/limits.ts`). When an account is deleted (`deleteAccount`), a workspace it
  owned goes with it while it holds no project and no AI agent; any other passes to the
  instance owner with what the account owned alone in it (`releaseOwnedWorkspaces` in
  `teams/service.ts`). God mode asks about sole-owned projects only outside the account's
  own workspaces. The owner deletes a workspace under the same rule
  (`DELETE /workspaces/:id`, `workspaceDeletion` in `workspaces/service.ts`). No core
  route hands a workspace over; `transferWorkspace` is there for a build that offers it.
  SCIM provisioning creates and attaches accounts across the instance, so it is set up in
  god mode (`/god/scim`); a hosted build also sets it up per workspace with
  `setWorkspaceScim()` from `@repo/auth`, whose routes (`workspaceScim` guard) are each
  workspace owner's (see SCIM below).
- **A member of the team joins a project directly** (`POST /projects/:key/members`,
  from the candidate list); anyone else joins through an invite, which puts them in
  the team as well. A team invite (`/teams/:teamId/invites`) names no project, so its
  email cannot go through the notification outbox, which belongs to a project:
  `invites/email.ts` sends it at once, without the outbox's retries. One
  pending invite per (team, email) and per (project, email) — partial unique indexes →
  409, and so is an address already in the team or in the project: accepting such an
  invite would rewrite the membership it already holds, demoting an owner past the
  last-owner check. An expired invite gives way: inviting the address again, or
  renewing it (`.../invites/:inviteId/renew`), replaces it with a new invite under a new
  link. A link is never reissued, and an expired one is neither accepted nor mailed.
  An address takes an invite only where the installed policy admits it
  (`invites/email-policy.ts`, 400 `EMAIL_DOMAIN_NOT_ALLOWED`): by default, one with an
  account always and one without only if it could register. A build that lets a
  workspace keep domains of its own calls `setInviteEmailPolicy` with a check against them.
  `members/` removes (last owner protected).
- The member list of a project is governed by its role matrix **or** by the team that
  owns it: `memberAdmin: ["members_manage", "<action>"]` passes an owner or manager of
  the team without a `project_member` row of their own, and every member route uses it
  — list, add, assign a role, describe, remove. The two that address one member by
  `:userId` use `memberSelfOrAdmin` instead: that member acts on their own row —
  leaving the project, saying what they do in it — with no member permission at all.
  The one standing the member permission does not carry is `owner`: an owner bypasses
  the matrix, so adding one, promoting to one and _inviting_ one all go through the
  same rule — an owner of the project, or an owner or manager of the team that owns it
  (`assertProjectAdmin`, and `mayGrantInviteRanks` for the invite). The team rank is
  stricter still: only a team owner grants, takes or invites `owner` and `manager`
  there. An invite is checked against its sender twice, once when it is made and again
  when it is accepted: the sender can be demoted or deleted while the link is out, and
  a link must not outlive the standing that issued it (409 on accept).
- `project_member.source` says which path a row came from: `modules/scim/reconcile.ts`
  only ever writes, re-roles or removes its own `'scim'` rows, and `members/` refuses to
  edit or remove one (409) because the next sync would undo the change. A project
  membership it grants comes with a `team_member` row in the owning team, added as a
  plain member — the same order an accepted invite follows. `team_member.source` marks
  that row the same way, and it is removed again once the sync holds no project
  membership of that team; a row someone else created, or one whose rank was raised
  afterwards, stays. `teams/` refuses to remove or leave such a row for the same reason
  `members/` refuses its project one: the rank is the team's to set, the membership
  itself is the identity provider's.

## Team-owned agents

Agents, the skill library, the configured tools and the integration credentials belong
to the team; the routes are under `:teamId` and use the `teamPermission` guard. What
stays under `:projectKey` is what happens in one project: an agent's chat, its runs and
its schedules. `packages/db/AGENTS.md` has the schema side.

Two decisions a reader would otherwise propose again:

- **The team is the boundary.** There is no instance-level agent and no non-human-identity
  flag on the user. An agent is reachable through its team or not at all.
- **The `ai_agents` permissions are administrative.** A role granting `create` or `edit`
  can make an agent, attach it to the projects the caller sees, and read its key — so
  granting either is granting everything an agent of those projects can reach. What the
  agents spent is a resource of its own, `agent_usage`, read only, so reading it
  administers nothing.
- **An agent's role is its `project_member` row**, per project, set from the project's
  member list like a person's. Attaching an agent joins it on the team's default role;
  `members/` refuses to make it an owner, since an owner bypasses the matrix.

Runs of an internal agent are traced. `runtime/observability.ts` holds the one Mastra
container of the process: an agent built for a run writes no spans on its own, so every
one is registered with it, and its exporter writes the spans into Mastra's own table on
the application database. A run names what it belongs to in the trace metadata — the
agent, the team, the project, the issue and the schedule, and either the queued run with
its trigger or, for a chat run, the person who asked — which is what `runtime/traces.ts`
filters on, since the spans carry no foreign keys of ours. How long they are kept is the
instance setting under god mode (`app_setting` key `agents`); `runtime/trace-retention.ts`
applies it from the api's background loop. The window applies to whole runs: the sweep
finds the root spans past it and deletes their traces whole, and the same sweep drops
the traces of a deleted team.

The same setting holds the longest one run may take (`maxRunSeconds`). An agent can set a
shorter limit of its own (`ai_agent.run_timeout_sec`), and a workspace ceiling from
`setLimitsProvider` lowers both. A run that reaches it is aborted and saved as failed with
the text it had produced. A claim's lease is kept longer than the instance maximum, so the
poller does not claim a run again while it is still running.

The run traces also back the agent dashboard (`runtime/analytics.ts`) at
`GET /teams/:teamId/agent-analytics`: runs, tokens and cost by model, agent, project and
day, over a window and the same span before it. Its owner and managers read every project
of the team; anyone else the projects where their role grants `agent_usage` `read`
(`projectsWithPermission` in `shared/access.ts`), since a role is set per project and a
team-wide figure would show the others. The response names those projects
(`readableProjects`), and `projectId` narrows the dashboard to one of them.
`GET /workspaces/:workspaceId/agent-analytics` reads it over every team of a workspace,
with the teams compared, for its owner and its admins.

Cost is applied in the api, not read from a span. Mastra computes it in a metrics
pipeline that needs an analytics store its Postgres adapter does not implement, so the
spans arrive with raw token counts and `runtime/model-pricing.ts` prices them from the
table `@mastra/observability` bundles for that pipeline (`dist/metrics/pricing-data.json`).
Its provider ids are the registry `AI_PROVIDERS` mirrors, so a credential's integration
key matches it directly. The file is outside the package's exports map: a release that
moves it leaves the table empty, an unpriced call reports no cost, and the dashboard shows
the tokens without an amount.

A workspace sets its own price for any model in `model_price`, which the dashboards of its
teams read before the table (`ownPrices` in `analytics.ts`): a model the table lacks, such
as one behind an OpenAI-compatible proxy, or one bought at another rate. The cost is
worked out when a dashboard is read, so a price also recounts past calls.
`modules/agents/prices` serves the list to the workspace's owner and its admins: the
models it called in the last 90 days with those no price covers first, and the whole
table, paged, each beside the workspace's own price.

Over MCP the team is resolved from the API key rather than asked for (`mcp/server.ts`):
an agent's key acts in its own team, a person with one team in theirs, and a person in
several passes `teamId` after reading `list_teams`.

MCP reach is the team's too. `team.mcp_enabled` opens the team to MCP clients, and
`project.mcp_enabled` says which of its projects that reach covers; both are written
from `PATCH /teams/:teamId/mcp`, never from the project. The project guards check both
through `assertMcpEnabled`, which reads them off the resolved project row — `ProjectRow`
carries `teamMcpEnabled` from the join it already makes. The team guards check the team
switch through `assertTeamMcpAllowed`, which is what covers the resources no project
flag reaches: the agents, the skills, the tools, the roles and the credentials.

## Extension hooks

A build that extends the api, such as the hosted edition, installs these at startup
before `listen`. A self-hosted instance installs none and runs the defaults. The schedule
and run setters put their default back when called with no argument, which is how a test
undoes one.

- `setLimitsProvider`, `setOwnedWorkspaceLimit` (`shared/limits.ts`): a workspace's
  ceilings.
- `setScheduleTypes`, `setScheduleOptionsCheck`, `setScheduleIssueFilter`
  (`modules/agents/schedules/extension.ts`): schedule types of its own beside `cron` and
  `status`; the `options` it keeps on a schedule, checked on every write and, with the id
  maps, on a project copy; and which issues start a schedule's run. `queueScheduleRuns`
  (`issue-runs.ts`) queues the runs of its types on issues, with the trigger `event`. A
  schedule of a type or with options no installed extension reads (`isScheduleSupported`)
  stays as it is, so it works again once the extension is back, but starts no run and
  answers 409 to an update; only a delete goes through.
- `setRunAdmission` (`modules/agents/core/run-admission.ts`): the seconds a claimed run
  waits before it starts, asked in the poller and in a runner's claim.
- `setRunRefusal` (`modules/agents/core/run-refusal.ts`): whether an internal agent works
  at all, asked in the poller before a queued run starts and in `prepareRun` before a chat
  answer. A reason fails the run without a retry, and answers the chat with 403.
- `onProjectEvent` (`modules/webhooks/emit.ts`): every issue and comment event the
  webhooks get, inside the request that caused it.
- `setRequestTracker` (`shared/request-tracker.ts`): every request, with its declared
  route, params and body, before the guards run; a request it follows gets its status,
  its account and the handler's value back after the handler, before the answer is sent,
  or the status of the error a guard or the handler refused or failed it with.

Functions with no setter, for the routes such a build adds:

- `getAgentAnalytics({ teamIds, projectIds }, days)`
  (`modules/agents/core/runtime/analytics.ts`): the agent dashboard over any set of
  teams, or some of their projects.
- `tracedRuns(scope, from)`, `analyticsWindow(days)` (same file): the runs the dashboard
  is read from, with the whole trace metadata, and its window, for figures of the
  build's own.
- `workspaceScope(workspaceId)`, `onlyProject(scope, projectId)` (same file): the scope
  of the workspace dashboard, and a scope narrowed to one project as the team dashboard
  does it.
- `estimateCost(provider, model, usage, calls, own)` (`runtime/model-pricing.ts`): what
  model calls cost, with `own` from `ownPrices(scope)` (`analytics.ts`) so a workspace's
  prices count.
- `projectsWithPermission` (`shared/access.ts`): the projects a member may read.

## SCIM

`modules/scim/` serves SCIM 2.0 (RFC 7643 / 7644) at `/scim/v2` for an identity provider
to provision users and groups with. Three things make it unlike every other module:

- **Mounted on the root app in `app.ts`, not under `planner`.** The planner's `authContext`
  answers 401 before the bearer check could run. Authentication is one `resolve` that hands
  the token to `verifyScimToken` from `@repo/auth`, which answers with the provider the
  token belongs to: the instance's (`workspaceId` null) or a workspace's. Every route acts
  for that provider, and every function in `service.ts` takes its `workspaceId`.
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
brings people in, and that is what makes `registration: 'closed'` plus SSO work.

An account is one `user` row across the instance. What a provider says about a person — its
own id for them and whether they are active — is a `scim_user` row per (provider, user), where
`workspace_id` is null for the instance's provider. Groups belong to a provider
(`scim_group.workspace_id`, null for the instance's), their names are unique within it, and
their members must be accounts it sees. A create for an address that has an account links
it. The group mappings are in `scim/mappings.ts`; they and the settings are served from god
mode (`/god/scim/...`) and, for a workspace, from `modules/workspaces/` (`/workspaces/:id/scim/...`).

- **The instance's provider** is god's, set up in god mode, and every build has it. Its
  token reads `scim_<secret>`. The provider sees every account, PUT and PATCH write the name
  and address, a group maps to any project, and DELETE removes the account the way god mode
  does (409 for the only owner of a project outside the workspaces they own, whose projects
  pass to the instance owner).
  A deactivated account (`user.active` false, written alongside `scim_user.active`) keeps
  its teams and projects but cannot sign in, and `isAccountDeactivated` makes
  `authContext`, `/me` and the MCP key check refuse what it already holds.
  God mode writes `user.active` too (`POST /god/users/:userId/deactivate` and
  `/reactivate` in `modules/god/`) while the instance's provider does not manage accounts
  (`accountsManagedByScim` from `@repo/auth`), and answers 409 while it does. Deactivating
  there also deletes the account's sessions, its MCP OAuth tokens and the pending invites
  it created; its API keys are kept and answer 401 until it is reactivated. The instance
  owner and an agent's account are refused (403). The user list and detail carry
  `activeLock` (`owner`, `agent` or `scim`), the reason the switch is locked, or null.
- **A workspace's provider**, where a hosted build turns `setWorkspaceScim()` on, decides
  who is in the workspace, not who has an account, so the same person can be linked by
  several workspaces. Its token reads `scim_<workspaceId>_<secret>`. It sees the accounts it
  linked and the people in the workspace's teams (`inWorkspace` in `service.ts`), a name or
  address it sends is accepted and the account keeps its own, and a group maps to projects
  of its workspace only. The instance's groups grant nothing in a workspace that set up
  SCIM of its own (`workspacesWithOwnScim`): `reconcile.ts` leaves them out there, the
  mapping picker leaves its projects out, and turning that workspace's SCIM on or off
  reconciles its mapped projects (`reconcileWorkspaceGrants` in `scim/mappings.ts`).

A create first asks the installed policy whether the provider may provision the address
(`email-policy.ts`, with `workspaceId` null for the instance's). By default it allows any
address, since only god sets up the instance's provider; a hosted build calls
`setScimEmailPolicy` with a check against the domains a workspace has verified, and a refused
address answers 400 `invalidValue`.

Set up per workspace, deactivation (`active: false`) and DELETE take the person out of every
team of the workspace through `dropWorkspaceMemberships` in `teams/service.ts`, invite memberships
included, and a team or project they owned alone passes to the workspace owner. Neither
touches the account or its sessions. A deactivated person stays linked, so the provider can
turn them back on, and `reconcile.ts` grants them nothing through the groups until then.

The `god`-role account is refused (409), because nothing about the instance owner is
provider-owned; set up per workspace, so is the workspace owner, who receives what a
deprovisioned person owned alone. A create for an address the provider already linked
with an `externalId` is refused the same way — it is a retry, not a new person, and must not
overwrite the link the first create wrote.

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
`PATCH /Groups/:id` or an unmapping in the workspace settings.

## Issue agent runs

`GET /issues/:issueId/agent-runs` reads triggered runs with cursor pagination. Both
`work_items read` and `ai_agents read` in the issue's current project are required.
Runs keep their original project, so a moved issue does not expose its former project's
prompts or traces. `/issues/:issueId/agent-runs/:runId/trace` reads the latest recorded
attempt of that run, or the one named by `traceId`. Each trace links to the previous recorded
attempt. A missing latest trace returns null; an unknown or unrelated `traceId` returns 404.
Both permission checks and the read use the same resolved project id. Other people's chat
traces stay private.
External runners reporting run events also retain messages, tool inputs/results and a
local Codex session link per attempt. `GET /agent-runs/:runId/trace?attempt=N` uses
both read permissions in the original project and excludes moved issues. It also
serves scheduled/manual runs without an issue. The latest recorded attempt is the default. The runner queue lists active and past external runs; `runId` narrows it to one authorized run for the detail pane. External transcripts follow the instance trace retention window after the run finishes; pending runs and final results are retained.
`POST /agent-runs/:runId/events` accepts only the calling agent's current executing,
unexpired attempt. Event offsets deduplicate retries and reject gaps. Transcripts
stop recording after 2,000 events or 1 MB; acknowledgements continue so the runner
can report its final result. A Codex UUID forms the local `codex://threads/` link;
no supplied URL is accepted. The event-capable runner also sends the attempt number
on heartbeat and result calls, so a reclaimed attempt rejects the old process.
Legacy clients may omit this field for compatibility.

## Security

- **`GET /attachments/:publicId/raw` is public and unauthenticated** (used in
  `<img>`/`<video>`). Preserve its defenses if you touch it: `X-Content-Type-Options:
nosniff`, forced download outside a strict media allowlist, locked-down CSP.

## Tests

`bun test` with **Eden Treaty** driving the app in memory against a real test Postgres
and real better-auth sessions — nothing is mocked. Import `app` via the helpers (from
`src/app.ts`), never `src/index.ts` (it binds the port).

**Setup.** `bun run setup` at the repo root creates the `*_test` database next to the dev
one, writes `.env.test`, and migrates it. To do it by hand instead:

```bash
cp .env.test.example .env.test        # repo root; DATABASE_URL must name a *_test database
bun run db:migrate:test               # migrate it (repo root)
bun run test                          # from apps/api, or at root via turbo
```

The `test` script loads `--env-file=../../.env.test`. The attachments test also needs
RustFS + `S3_*` in `.env.test` (`docker compose -f docker-compose.dev.yml up -d` creates
the bucket); the Docker test gate starts its own throwaway RustFS.

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
- A test that runs an internal agent against a model leaves its spans in the trace
  exporter, which writes them in batches up to 5 s later. By then the next test has reset
  the database and reused the ids, so the late spans count as that test's runs. Flush them
  before the test ends, in `afterEach` or right after the run:
  `await getMastra().observability.flush()`.

## Rules

- Auth logic is in `@repo/auth`, DB access via `@repo/db` — do not re-instantiate
  either. The web app never imports these packages; it uses this API over HTTP.
- CORS `origin` is the `trustedOrigins` list exported by `@repo/auth` — do not re-parse
  `APP_URL` here.
- swagger `/docs` (planner) is separate from better-auth's `/api/auth/reference`; both
  stay reachable without a session.
- Dev: `bun run dev`. Prod: the Dockerfile migrates, then starts the server; the compose files and the Helm chart run the migrations as a separate step and start only the server.

## Runner queue and execution state

`GET /agent-runs/queue` pages external runs across the caller's readable projects,
including archived projects. Both `work_items read` and `ai_agents read` are required
in each project. Moved issues do not expose their original project's prompt.

The stored `status` keeps the runner protocol's `pending` value. `executionState`
is `running` only after admission succeeds and while its lease is valid; it is
`queued` during delays, retry backoff and after lease expiry. Terminal states retain
their names. `execution_started_at` is cleared on claim, defer, retry and completion,
and set before execution is handed out. A heartbeat can restore the marker for a
claimed external run that was already in flight when this column was added.

`runnerQueue:1` is a user-scoped sync marker. It combines the visible projects'
`runner-queue:` revisions with lease expiry and runner presence, so time-based state
changes are visible without a write. The queue and issue run panel share this scope.
A runner being online is separate from a run holding an execution lease.
