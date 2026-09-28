# Breaking changes

Each release that removes or moves an API path is listed here, newest first. A script
or an MCP client that calls the API by path needs the replacement. The web app is
released with the API and needs no change.

## MCP lists a compact tool catalog

`tools/list` on `/mcp` lists workspace search, the common reads, the image tools and
three discovery operations: `discover_tools`, `call_read_tool` and `call_tool`. The
other tools are found with `discover_tools` and run through the two executors. A call
by a tool's own name still works. `/mcp?catalog=full` lists every tool, as before.

The document tools answer with Markdown `content` and leave out `contentJson` unless
the call passes `includeContentJson: true`. The REST routes are unchanged. See
[agent discovery over MCP](mcp-discovery.md).

## MCP access moves to the team

Whether MCP reaches a project is now set on the team that owns it, not on the project.
A team carries an `mcpEnabled` switch, and each of its projects is either in the reach
or out of it.

`PATCH /projects/:projectKey/settings` no longer takes `mcpEnabled`. `PATCH
/teams/:teamId/mcp` takes both settings instead, and answers with the current state:

```
PATCH /teams/:teamId/mcp
{ "enabled": true, "projects": [{ "projectId": 12, "enabled": false }] }
```

The switch is written by an owner or a manager of the team. It is read from
`GET /teams` (`mcpEnabled` per team) and `GET /teams/:teamId/projects` (`mcpEnabled`
per project); `GET /projects/:projectKey/settings` reports both as read-only fields,
`mcpEnabled` and `teamMcpEnabled`. A project is reachable over MCP only while both
are on.

The team's own resources — its agents, skills, configured tools, roles and
integration credentials — follow the team switch as well. With it off, every
`/teams/:teamId/...` call over MCP answers 403, and `list_teams` stops listing the
team.

## Agents, skills, tools and integration credentials move to the team

An AI agent belongs to a team. So do the skill library, the configured tools and the
integration credentials, and every project of the team shares them. The routes moved
with them: `:projectKey` becomes `:teamId`. The response shapes do not change.

`GET /teams` lists the teams you belong to and gives the id these paths take.

| Removed                                                            | Replacement                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `/projects/:projectKey/ai-agents`                                   | `/teams/:teamId/ai-agents`                                    |
| `/projects/:projectKey/ai-agents/:agentId`                          | `/teams/:teamId/ai-agents/:agentId`                           |
| `/projects/:projectKey/ai-agents/:agentId/regenerate-key`           | `/teams/:teamId/ai-agents/:agentId/regenerate-key`            |
| `/projects/:projectKey/ai-agents/:agentId/runs`                     | `/teams/:teamId/ai-agents/:agentId/runs`                      |
| `/projects/:projectKey/ai-agents/:agentId/skills`                   | `/teams/:teamId/ai-agents/:agentId/skills`                    |
| `/projects/:projectKey/ai-agents/:agentId/tool-configs`             | `/teams/:teamId/ai-agents/:agentId/tool-configs`              |
| `/projects/:projectKey/ai-agents/tools`                             | `/teams/:teamId/ai-agents/tools`                              |
| `/projects/:projectKey/agent-skills`                                | `/teams/:teamId/agent-skills`                                 |
| `/projects/:projectKey/agent-skills/:skillId`                       | `/teams/:teamId/agent-skills/:skillId`                        |
| `/projects/:projectKey/agent-skills/:skillId/markdown`              | `/teams/:teamId/agent-skills/:skillId/markdown`               |
| `/projects/:projectKey/agent-skills/:skillId/references`            | `/teams/:teamId/agent-skills/:skillId/references`             |
| `/projects/:projectKey/agent-skills/:skillId/references/content`    | `/teams/:teamId/agent-skills/:skillId/references/content`     |
| `/projects/:projectKey/agent-skills/github/discover`                | `/teams/:teamId/agent-skills/github/discover`                 |
| `/projects/:projectKey/agent-tools`                                 | `/teams/:teamId/agent-tools`                                  |
| `/projects/:projectKey/agent-tools/:agentToolId`                    | `/teams/:teamId/agent-tools/:agentToolId`                     |
| `/projects/:projectKey/integrations`                                | `/teams/:teamId/integrations`                                 |
| `/projects/:projectKey/integrations/:credentialId`                  | `/teams/:teamId/integrations/:credentialId`                   |
| `/projects/:projectKey/integrations/catalog`                        | `/teams/:teamId/integrations/catalog`                         |
| `/projects/:projectKey/integrations/models/:provider`               | `/teams/:teamId/integrations/models/:provider`                |
| `/projects/:projectKey/integrations/options`                        | `/teams/:teamId/integrations/options`                         |

`PUT /teams/:teamId/ai-agents/:agentId/projects` is new. It replaces the set of team
projects an agent works in.

The agent chat, the schedules and the paths that start a run stay project-scoped, and
their paths do not change.

### Over MCP

The tools keep their names. Those that manage agents, skills, tools or credentials
take a `teamId` in place of a `projectKey`. The API key gives the team, so an agent
and a person who belongs to one team send no `teamId`. A person in several teams
sends it, and reads the ids from the new `list_teams` tool.

### Runner scope

`runnerScope` on an agent accepts `owner` or `team`. The value `project` is renamed
to `team`, and the migration updates the existing rows. A client that sends `project`
is rejected. Only the name changes: the field still selects which runs an external
agent's runner receives, the runs of the owner only or the runs of every member.

### Roles

Every agent has a team role. An agent may do only the actions that it was granted and
that its role permits. An action the role refuses answers 403 during the run, and the
action picker marks it before the run.
