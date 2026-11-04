# SCIM

## api

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


## @repo/auth

What a provider says about a person is kept per provider in `scim_user`, written by
`apps/api`. The instance's provider is set up in god mode and stored with `workspace_id`
null; a hosted build also lets every workspace set up its own with `setWorkspaceScim()`
(`workspaceScim()` reads it). The instance's provider writes `active`, one more
`additionalField` on the user table (nullable, so every check is `active !== false`).
God mode writes `active` too, from the users table, while that provider does not manage
accounts (`accountsManagedByScim`: its SCIM on with a token); while it does, `apps/api`
answers god's switch with 409. An account with `active` false (`isAccountDeactivated`) is
refused at sign-in by the `session.create.before` hook with `ACCOUNT_DEACTIVATED`, which
covers every sign-in method at once; `apps/api` refuses the sessions and keys it already
holds. A workspace's provider decides who is in the workspace, not who has an account;
`active` is not written for it, and nothing here refuses a session.

`getScimSettings` / `rotateScimToken` / `verifyScimToken` take the workspace, or null for the
instance, and hold the bearer token the SCIM endpoints in `apps/api` authenticate with. The
instance's is stored under `auth.scim` and reads `scim_<secret>`; one it held while it
belonged to the first workspace reads `scim_<id>_<secret>` and keeps working. A workspace's
is stored under `workspace.<id>.scim` and reads `scim_<workspaceId>_<secret>`, so
`verifyScimToken` checks the instance's first and then reads only the named workspace's.
The token is returned in the clear exactly once, when it is generated; only its prefix is
