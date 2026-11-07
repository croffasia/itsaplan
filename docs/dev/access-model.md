# Access model

How the api decides who may do what. The rules an agent must follow are in
`apps/api/AGENTS.md`. Paths are relative to `apps/api/src/`.

Access is enforced through macros in the route options. A rule that depends on the fetched row
or on the request body is checked in the handler or the service.

## Session

- `authContext` (`shared/auth-context.ts`) puts `user` on the context, and `planner.ts` applies it
  to every planner route. It reads the account through `requestUser`, which takes a session, an
  `x-api-key` header or the MCP OAuth token of a tool call.
- A request with no account gets 401. The GET routes in `PUBLIC_GET` run with `user: null`
  instead: raw attachments, avatars, `/invites/:token` and `/share/*`. A `/share/*` token reads a
  shared issue or view with no membership.
- `authContext` answers 401 for a deactivated account. `requestUser` leaves that check to its
  caller, so `/me`, which runs outside the planner, makes the check itself.
- An API key cannot manage the account: `/api/auth/*` and `/account/connected-apps` refuse it.

## Membership and workspace roles

- Access to a project comes from a `project_member` row (`owner` | `member`), from the caller's
  role in the workspace that holds the project, or from both.
- Owners bypass the permission matrix. The global `user.role` (`god` | `user`) does **not**:
  `getProjectAccess` never reads it. God acts through its own routes under `/god`.
- A project keeps at least one owner. `members/` answers 400, `teams/` and SCIM answer 409. The
  code enforces this; the database has no constraint for it.
- Workspace roles are `owner` and `admin`, stored in `workspace_manager`. They reach every team
  and project of the workspace without a membership row: the owner as an owner of each, an admin
  with a matrix that only reads. The table is `shared/workspace-roles.ts`.
- `ai_agents.read` also opens the agent run and chat routes, and an internal agent's tools act
  with the agent's own key. So a workspace admin can start a run that writes.
- **Whether the caller reaches something:** `getProjectAccess` and `getTeamAccess` in
  `shared/access.ts` merge the membership with the grant, and the project and team guards read
  them. Workspace guards read `requireWorkspaceManager`. `listProjects`, `listTeams` and `readRevs`
  take the reached teams the same way. `listProjects` and `listTeams` answer `via: 'workspace'`
  for what the caller reaches only through the workspace.
- Two caller checks use the rows. `agentScopeOf` gives every agent of a team only to someone who
  runs the team; anyone else, a workspace admin included, reaches the agents that share a
  `project_member` row with them. A private view takes a project membership of their own
  (`via: 'member'`).
- **Whether someone else is a member:** assignees, mentions, watchers, notification recipients,
  seats, the last-owner check and SCIM read the rows. A workspace owner or admin with no row is in
  no member list, gets no notifications and takes no seat. With a row they count as any other
  member. An admin holds a team row when appointed (`addAdmin`). The owner gets one by creating a
  team or a project in the workspace.

## Guards

- **`:projectKey` routes:** `.use(guards)`, set one macro, read the resolved `project` from
  context.
  - `projectMember: true`: any member.
  - `permission: ["<resource>", "<action>"]`: the role matrix.
  - `projectOwner: true`: an owner of the project.
  - `projectAdmin: true`: an owner of the project, or an owner or manager of its team.
  - `teamRunsProject: true`: an owner or manager of its team.
  - `memberAdmin`, `memberSelfOrAdmin`: see [Member lists](#member-lists).
  - `feature: "<section>"` goes beside them and closes the route while the project has that
    section off. A route that belongs to two sections takes both in an array.
- **Team routes:** `teamMember`, `teamManager`, `teamOwner` and `teamPermission` inject
  `membership`.
- **Workspace routes:** `workspaceManager`, `workspaceOwner` and `workspaceScim` inject `standing`.
- **Entity-by-id routes** (`PATCH /issues/:issueId`): define a local macro with
  `entityGuard(resource, notFound, resolveProjectId, feature?)` and set it in the route options
  (`workItem: "edit"`). It injects `projectId` and runs `assertPermission` and
  `assertProjectReachable`.
- **A handler that checks a permission itself** spreads `requiresPermission([...])` into its
  `detail`, so the MCP tool table still reports the requirement: `GET /issues/:issueId`, and
  `PATCH` and `DELETE /views/:viewId`.
- **A route that resolves the project itself** runs one of two checks on it.
  `assertProjectReachable` covers the run binding, the MCP toggle, the optional section and writes
  to an archived project. `assertMcpAllowed` covers only the run binding and the MCP toggle, so a
  route that writes and uses it also calls `assertWritable`, as `moveTarget` does.
- **`POST /issues/:issueId/move`** checks the target project in the `moveTarget` macro, which reads
  `projectId` from the body and asserts `work_items` `create`. `GET
/projects/:projectKey/issues/:sequenceNumber` asserts the read permission on the issue's project
  when an old number resolved to an issue now in another project.
- **MCP toggle** (`assertMcpEnabled`): the team switch, then the project flag. It applies only to
  calls through `POST /mcp`, and an internal agent's run skips it. Team macros apply only the team
  switch. Workspace macros apply neither.
- **Run binding:** the run's tool dispatch sets `x-agent-project`, and a check above refuses an
  object outside that project (403). On `:projectKey` routes the dispatch sets `projectKey` to the
  run's project. Cross-project lists filter by `boundProjectId`.
- **`x-permission`:** a guard built on one matrix pair publishes it on the route's OpenAPI detail,
  and `mcp/generate.ts` reads it there. These are `permission`, `memberAdmin`, `memberSelfOrAdmin`,
  `teamPermission` and `entityGuard`. Guards that check only a standing publish nothing, and
  neither do `worklog`, `comment`, `moveTarget` and `viewableAttachment`, whose rule depends on the
  row or the target. The value is one pair, so it can understate a route: `move_issue` reports
  `work_items` `delete` and omits `create` on the target.

## Workspaces and teams

- **Team creation** (`POST /teams`, `assertMayCreateTeam` in `modules/workspaces/service.ts`): the
  workspace named by `workspaceId` decides through `teamCreation`, which only its owner sets.
  `owner` (the default) lets its owner, `managers` also its admins, `members` also anyone in one of
  its teams. An agent's bot user never creates one. Anyone else gets 403, god included.
- A team is in the workspace named when it was created. Its creator is its team owner and need not
  own the workspace. Everyone in a workspace's teams shares that workspace.
- **Public links** (`projectSharingEnabled` in `modules/workspaces/service.ts`): three settings
  decide whether a project's links open and a new one can be made. God sets the instance's
  (`/god/sharing-settings`). The workspace's owner and admins set `sharingEnabled`. Only its owner
  sets `sharingTeamsOnly` and the chosen teams. While any of them closes a project, its links
  answer 404 and a new link gets 403. Revoking still works. The tokens stay, so the same links open
  when sharing is on again.
- **Personal workspaces:** no route creates a workspace. While `personalWorkspaces` is on in the
  auth settings (the default), a person who owns none gets one at sign-up, or on the next request
  through `ensurePersonalWorkspace` in `authContext`. While it is off, only the instance owner gets
  one, and anyone else works in the teams they are added to. An agent's bot user never owns one.
- **Account deletion** (`deleteAccount`): god and the instance's SCIM provider delete an account.
  There is no self-delete, and the instance owner cannot be deleted. A workspace the account owned
  is deleted while it holds no project and no AI agent, with all its teams. Any other passes to the
  instance owner, with the teams and projects the account owned alone in it
  (`releaseOwnedWorkspaces` in `modules/teams/service.ts`). This is the only way a workspace changes
  owner. God mode asks about sole-owned projects only outside the account's own workspaces: 400
  unless `?withProjects=true`, which deletes them.
- **Workspace deletion** (`DELETE /workspaces/:workspaceId`, `workspaceDeletion` in
  `modules/workspaces/service.ts`): the owner deletes a workspace that holds no project and no AI
  agent. Any other answers 409.
- **SCIM** is set up in god mode (`/god/scim`) for the instance. The `workspaceScim` routes are the
  workspace owner's, and answer 403 unless SCIM is set up per workspace. See `docs/dev/scim.md`.

## Joining a project

- **A member of the team** is added directly (`POST /projects/:projectKey/members`, with
  `members_manage` `create`). Someone outside the team gets 400.
- **Anyone else** joins through an invite, which puts them in the team as well. Creating a project,
  attaching an agent, SCIM and the hand-over of sole ownership write rows without an invite.
- **Who invites:** a project invite takes `memberAdmin: ["members_invite", "create"]`, a team
  invite (`POST /teams/:teamId/invites`) takes `teamManager`.
- An invite belongs to its address: accepting takes a session with that email, otherwise 403.
- One pending invite per (project, email), and one pending team invite with no project per (team,
  email). Partial unique indexes answer 409, so an address can hold one of each.
- An address already in the project or the team gets 409. A team member is added from the member
  list. Accepting also refuses someone who joined the project in the meantime (409
  `ALREADY_PROJECT_MEMBER`), and never lowers a team rank.
- Inviting the address again, or renewing (`.../invites/:inviteId/renew`), replaces an expired
  invite with a new one under a new link. A link is never rewritten. An expired invite is not
  accepted, and the email routes refuse it. A project invite email already in the outbox can still
  go out after expiry.
- **Address policy** (`modules/invites/email-policy.ts`, 400 `EMAIL_DOMAIN_NOT_ALLOWED`) runs on
  create and renew. By default an address with an account passes, and one without passes when its
  domain is in `allowedEmailDomains` (an empty list allows all). It does not read `registration`,
  so an invite can go to an address that cannot register on a closed instance.
  `GET /teams/:teamId/invites/candidates` leaves out whom the policy refuses, and answers 403 while
  `inviteSearch` is off (the default).

## Member lists

- `memberAdmin: ["members_manage", "<action>"]` passes on the role matrix, or for an owner or
  manager of the team without a `project_member` row. List, candidates, add and assign a role use
  it. Nobody changes their own role (400).
- `memberSelfOrAdmin` is on the two other `:userId` routes, describe and remove. A member acts on
  their own row, leaving the project or saying what they do in it, with no member permission.
  Anyone else needs what `memberAdmin` asks for.
- **Project `owner`:** an owner bypasses the matrix, so the member permission does not hand it out.
  Adding, promoting, demoting, removing and inviting an owner take an owner of the project, or an
  owner or manager of its team (`assertProjectAdmin`, and `mayGrantInviteRanks` for an invite).
- **Team ranks** (`setTeamMemberRole`): a team owner or manager sets a non-owner to `member` or
  `manager`. Only a team owner grants or takes `owner`, invites `owner` or `manager`, or removes a
  member. Nobody changes their own rank.
- **Invite sender:** `mayGrantInviteRanks` runs when the invite is made and again when it is
  accepted, so a sender who was demoted or deleted leaves the link refused (409). It covers project
  `owner` and a team rank above `member`. A plain or custom-role link stays valid. Removing the
  sender from the team deletes their pending invites there (404).
- **Custom roles:** adding, re-roling, inviting or renewing with a `roleId` goes through
  `assertGrantablePermissions`, which refuses a role that grants more than the granter holds. A
  project owner, or an owner or manager of the team, is not capped. The project's invite list hides
  the link of an invite whose role the viewer could not grant.

## SCIM rows

- `project_member.source` is `'scim'` for a row the sync made, and `'invite'` for every other row.
  `modules/scim/reconcile.ts` writes, re-roles and removes only its own `'scim'` rows. `members/`
  refuses to re-role or remove one (409), the owner leaving included, because the next sync would
  undo the change. Its description can be edited.
- A project membership from the sync comes with a `team_member` row in the owning team, added as a
  plain member with `source: 'scim'`. That row is removed once the person has no project row of any
  source in the team. A row someone else created, or one whose rank was raised, stays.
- `teams/` refuses to remove or leave a `'scim'` row of rank `member` (409). Its rank can be
  changed: the rank is the team's to set, the membership is the identity provider's.
- A workspace's provider, on deactivate or delete, removes every team and project row of that
  person in the workspace, of any source (`dropWorkspaceMemberships`). What they owned alone passes
  to the workspace owner.
- A SCIM group mapping can grant `owner` on a project, outside `assertProjectAdmin`. It is set up in
  god mode and on the `workspaceScim` routes.
