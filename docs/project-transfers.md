# Project transfers through MCP

`preview_project_transfer` and `transfer_project` move an existing project between
teams in the same workspace. The project keeps its ID and key, issues, documents,
settings, history, and user preferences. Its qualified reference changes from
`source.MOVE` to `destination.MOVE`.

Both tools require a human owner or manager of both teams. Workspace roles that
already grant that authority also qualify. Agents cannot transfer projects. MCP
must be enabled on the project and both teams for an MCP call.

## Preview and transfer

Find the destination with `list_teams`, then preview using the project's qualified
reference and the destination's ID:

```json
{
  "projectKey": "source.MOVE",
  "targetTeamId": 12
}
```

The preview reports the immutable `projectId`, `sourceTeamId`, new `targetRef`,
blockers, member roles that need mappings, destination feature availability, and
whether team notification providers change. `canTransfer` means there are no
blockers; each role in `requiredRoles` still needs an explicit mapping.

Call `list_role_options` for the destination team to choose its roles. Every human
project member must already belong to that team; the transfer does not invite
people or change their team standing. Project owners remain owners. Map each used
source member role to a destination role, or pass `null` to choose the destination's
default. Members without an assigned role also receive that default. If the team
has no default role, `null` retains the standard member permissions.

Call `transfer_project` with the IDs returned by the preview:

```json
{
  "projectKey": "source.MOVE",
  "projectId": 41,
  "sourceTeamId": 8,
  "targetTeamId": 12,
  "roleMappings": [{ "sourceRoleId": 6, "targetRoleId": null }]
}
```

Omit `roleMappings` when the preview reports no required roles. A successful call
returns the project with its new `teamId` and `ref`. Use that reference for later
calls. The same transfer request can be retried using the original reference and
IDs, including if the source team slug has changed or another project has since
reused the old key. A project moved
to a different destination returns a conflict instead.

## Blockers and concurrent changes

Restore archived projects and resolve duplicate destination keys before moving.
The preview also blocks missing destination memberships, foreign member roles,
SCIM mappings or memberships, pending project invitations, attached agents, agent
schedules (including paused ones), pending runs, managed repositories, and saved
actions. Detach or resolve those dependencies first. Team credentials stay with
their team; completed run history and resolved invitations remain historical
records. Arbitrary saved action JSON may reference team resources, so actions
must be removed before moving.

The transfer rechecks permissions and blockers in one transaction and locks the
affected teams and project. It commits the role mappings and ownership change
together. A failed transfer leaves the project unchanged. Database checks reject
late writes that refer to source-team roles, members, agents, invitations, or
repository connections. Action creation also checks the team seen during authorization
under a project lock, so an action queued behind the transfer is rejected. Project
deletion checks that team under the lock before removing threads, project data, or
stored objects; a deletion queued behind a transfer returns a conflict.
A conflict means the caller should preview again.

The REST endpoints are `POST /projects/:projectKey/transfer/preview` and
`POST /projects/:projectKey/transfer`, with the same bodies except `projectKey`
is the path parameter. This feature adds API and MCP tools; it adds no web UI.
