# API authentication and permissions

Code: `apps/api/src/shared/{auth-context,access,guards,permissions,workspace-roles}.ts`,
`packages/db/src/permissions.ts`, `packages/auth`. Commit `42fd2f40`.

## 1. Purpose

Every API route is gated by a session, then by project or team access, then by a guard, and for most routes one permission on a role matrix. This document states the checks a module's endpoints rely on.

## 2. Routes and screens

better-auth is mounted at `/api/auth/*`. Everything else is a planner route behind `authContext`.

## 3. Components

- `authContext` (`shared/auth-context.ts`) resolves `user` for each request from a better-auth
  session, an API key, or an MCP OAuth token. No credentials answer 401 `{"error":"Authentication
  required"}`. A deactivated account answers 401. GET routes for raw attachment, chat-attachment,
  initiative-attachment and avatar bytes, `/invites/:token` and `/share/*` need no session.
- `guards` (`shared/guards.ts`) are 15 Elysia macros a route declares: `projectMember` (any project
  member), `feature(name)` (closes the route while the project has that section off),
  `permission([resource, action])` (a matrix permission; owners bypass the matrix), `projectOwner`,
  `projectAdmin`, `teamRunsProject`, `memberSelfOrAdmin`, `memberAdmin`, `teamMember`, `teamManager`,
  `teamPermission`, `workspaceManager`, `workspaceOwner`, `workspaceScim`, `teamOwner`. Many routes use a
  guard other than `permission` and are not checked against the matrix; invite creation uses
  `memberAdmin` and an owner-rank check. `projectMember`, `permission` and `projectOwner` also refuse an
  MCP request when the project has MCP off, and refuse every method except GET and HEAD on an archived
  project (403 "This project is archived; restore it to make changes"); `permission` makes the exception
  for `danger_zone`. `entityGuard(resource, notFoundMessage, resolveProjectId)` is a factory a feature
  calls to build its own macro for routes addressed by an entity id. `requiresPermission` records the pair
  in the route's OpenAPI `x-permission`.
- `access.ts` holds the checks the guards call: `requireUser`, `requireGod`, `requireProjectAccess`,
  `requireProjectOwner`, `assertPermission`, `requireTeamMembership`, `assertWritable`, and others.
- `workspace-roles.ts` merges a workspace role's grant into project and team access
  (`AccessVia` is `member` or `workspace`).

### Permission matrix

`packages/db/src/permissions.ts` defines 25 resources and 4 actions (`create`, `edit`, `read`,
`delete`). A resource allows only some actions where `RESOURCE_ACTIONS` says so.

Resources: work_items, initiatives, cycles, dashboards, documents, views, members_invite,
members_manage, states, issue_types, labels, ai_agents, integrations, agent_skills, agent_tools,
agent_usage, custom_fields, issue_templates, workflow_config, actions, webhooks, repositories,
note_boards, import_export, danger_zone.

Restricted actions: `danger_zone` read, delete; `workflow_config` read, edit; `repositories` edit;
`agent_usage` read; `members_invite` read, create, delete.

| Role | Grants |
| --- | --- |
| Project owner | everything (bypasses the matrix) |
| Default member (`defaultMemberPermissions`) | all allowed actions on work_items, initiatives, cycles, documents, note_boards; read on dashboards, views, states, issue_types, labels, ai_agents, custom_fields, issue_templates, members_manage, members_invite |

Custom roles are stored per team and edited through the roles module.

## 4. API endpoints

Confirmed against the running API with the seed accounts:

| Request | Result |
| --- | --- |
| `GET /teams` without a session | 401 `{"error":"Authentication required"}` |
| `POST /projects/SEED/dashboards` as the member | 403 `{"error":"You do not have permission to create dashboards"}` |
| `POST /projects/SEED/dashboards` as the owner | 201 with the dashboard |
| `GET /projects/SEED/dashboards` as the member | 200 |

## 5. Database tables

`user`, `session`, `account` and related tables in `packages/db/src/schema/auth.ts`; `team_role`,
`project_member`, `team_member`, `workspace_manager` in `packages/db/src/schema/app.ts`. See `api-data.md`.

## 6. Permissions

This document is the permission definition.

## 7. Dependencies

`@repo/auth` (better-auth instance), `@repo/db`, Elysia.

## 8. Running it in isolation

A test repo that talks to this API needs only a session cookie (sign up and sign in at
`/api/auth/sign-up/email` and `/api/auth/sign-in/email`, with an `Origin` header the API trusts). A repo
that reimplements the API side would copy `packages/db/src/permissions.ts` and the files above.

## 9. Unconfirmed claims

- API keys and MCP tokens as credentials are taken from `requestUser`; not exercised.
- Workspace-role grants (`AccessVia` `workspace`) are not exercised by the seed data.
- Team roles and custom roles are not documented here; they belong to the roles module.
