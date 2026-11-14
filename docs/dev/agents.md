# AI agents: how they work

Paths are relative to `apps/api/src`. `runtime/` means `modules/agents/core/runtime/`.

## Ownership and access

Agents, the skill library, the configured tools and the integration credentials belong to the
team. Their routes are under `:teamId` and use the `teamPermission` guard. The integration
catalog, the provider models and the credential options take `teamMember` only.

Saving a credential, new or with changed fields, first asks its service whether it accepts it
(`integrations/credential-check.ts`), with one request that spends nothing. The api refuses only a
credential the service refused, so an outage never blocks a save through MCP. The dialog validates
first, on edit too (the stored secrets fill the fields left blank), and also holds back a credential the service gave no answer for (`unavailable`: an outage, a
timeout, a bot wall); one that cannot be checked from here (`unknown`: no such request, an address
the SSRF guard refuses) can be saved. A tool integration
checks itself (`verify` in its folder of `@repo/agent-tools`). An AI provider is asked for
`/models` at the address in Mastra's registry, or at the credential's base URL; the providers whose
address only their SDK holds, and the few with another request or refusal status, are listed by
hand in `integrations/provider-check.ts`.

A configured tool is bound to one credential of its integration, or to none when the integration
has no credential fields (PDF). An integration marked `credentialOptional` (Keenable) takes both: a
team can add its tools with no key, on the service's keyless tier, and again on a key.

What acts in one project stays under `:projectKey`: an agent's chat, its schedules and starting
a run. A run is read from the agent's history and traces under `:teamId`, the queue at each
scope, and `/agent-runs/:runId`.

Three decisions a reader would otherwise propose again:

- **The team is the boundary.** There is no instance-level agent and no non-human flag on `user`.
- **`ai_agents` `create` and `edit` are administrative.** `create` makes an agent, attaches it to
  the supplied projects and returns an external agent's key once. An omitted or empty list
  attaches it to none. Its stored owner can still list and read it. That key reaches those projects
  on the default role. `edit` attaches an existing agent to the caller's projects
  (`PUT /teams/:teamId/ai-agents/:agentId/projects`). The caller's projects are the ones they are
  a member of, or every project of the team for whoever runs it.

  `owner_user_id` is the creator and no edit changes it. The `owner` runner scope limits who may
  give the agent work to this owner, whoever chooses the scope. The owner always sees the agent;
  it grants no management bypass.

  An action that reaches every project the agent works in also takes running the team or being a
  member of all of them (`assertFullAgentAccess`): rotating the key, editing or deleting the
  agent, setting its tools or skills, and reading, rotating or testing its invocation. Setting
  tools or skills also takes `agent_tools` or `agent_skills` `edit`. The agent's `canManage`
  reports this rule, so the web hides those actions from a caller the api would refuse. The web
  attaches projects through `PATCH`, which takes full access, so it hides attaching as well,
  although the `PUT` route does not need it.

  `ai_agents` `read` is on the default role and gates chat and run. What the agents spent is a
  separate read-only resource, `agent_usage`.

- **An agent's role is its `project_member` row**, per project. Attaching an agent through the
  agent routes, or as a team default on a new project, joins it on the default system role. A
  project it already works in keeps its role. The project's member list sets its role like a
  person's and can add it on another role. `members/` refuses to make it an owner, since an owner
  bypasses the matrix.

## Schema

An AI agent is a row in `ai_agent` with a `team_id` and a `user_id`: the team that owns it and the
bot user it acts as. Code that lists agents reads `ai_agent`. `team_member.role` also tells an
agent from a person: it takes a fourth value, `'agent'`, which the seat count and the workspace
admin candidates leave out.

`agent_skill`, `agent_tool` and `integration_credential` carry a `team_id` and are shared by every
project of the team. `agent_schedule` and `agent_run` carry a `project_id`: a run happens in one
project.

The projects an agent works in are its bot user's `project_member` rows. The `role_id` on each is
what its requests in that project are checked against, so one agent can hold different roles in
two projects. An internal agent's rights in a project are the intersection of that role and its
actions: the keys in `ai_agent.tools` plus the always-on actions (`ALWAYS_ON_KEYS`). An external
agent has no such list, so its key is checked against the role alone.

A configured tool (`agent_tool`) is a catalog tool from `@repo/agent-tools` bound to a credential,
or a tool an extension of the api defines: its key is `<source>:...`, and the source set with
`setToolSource` (`agents/tools/extension.ts`) names it and runs it. A tool the instance does not
have, its integration or its source gone, stays listed with `supported: false` and no agent gets
it. An internal agent gets its enabled tools in its runs and chat answers, an external one over
MCP; a tool named as a core tool of the agent is left out.

`ai_agent_team_username_uq` makes the mention handle unique per team, ignoring case.
`assertUsernameFree` also refuses a handle a person holds.

## MCP

The team is resolved from the API key (`mcp/server.ts`). An agent's key acts in its own team, a
person with one team open to MCP in that team, and a person with several passes `teamId` after
reading `list_teams`.

`team.mcp_enabled` opens the team to MCP clients, and `project.mcp_enabled` says which of its
projects that covers. A new project starts from the instance's project default. After that, both
are written from `PATCH /teams/:teamId/mcp`, never from the project.

The project guards check both through `assertMcpEnabled`. The team guards check the team switch
through `assertTeamMcpAllowed`, which covers what no project flag reaches, such as the agents, the
skills, the tools, the roles and the credentials. An internal agent's tool calls do not count as
MCP access (`viaMcpEndpoint: false`), so neither switch stops them.

## Traces

Runs of an internal agent are traced. `runtime/observability.ts` holds the one Mastra container of
the process. An agent built for a run writes no spans on its own, so each one is registered with
it. Its exporter writes the spans into Mastra's `mastra_ai_spans` table on the application
database.

The spans carry no foreign keys of ours, so a run names what it belongs to in the trace metadata
(`prepareRun` in `runtime/index.ts`): the agent, the team, the project, the issue and the schedule,
and either the queued run with its trigger or, for a chat run, the person who asked.
`runtime/traces.ts` filters on the agent, the project, the issue, the queued run and the person.
`runtime/analytics.ts` and `runtime/trace-retention.ts` filter on the team. The trace of a chat run
is read only by the person who chatted, the team's owner included.

How long traces are kept is the instance setting `traceRetentionDays` under god mode (`app_setting`
key `agents`), 30 days by default, 0 to keep them. `runtime/trace-retention.ts` applies it from the
api's background loop. The sweep finds the root spans past the window and deletes those traces
whole. Each attempt of a retried run has its own trace, so a run can lose its older attempts first.
The same sweep drops every trace whose team no longer exists or that names no team, also when the
window is 0.

## Run time limit

`maxRunSeconds` in the same setting is the longest one queued run may take.
`ai_agent.run_timeout_sec` sets a shorter limit for one agent, and a workspace ceiling from
`setLimitsProvider` lowers both. A chat run has no limit.

A run that reaches the limit is aborted and saved as failed with the text it had produced. It is
not retried. The abort does not interrupt a tool call in flight: the run ends when the call
returns. A claim's lease is at least 60 seconds longer than the instance maximum, so the poller
does not claim a run again while it is running, unless a tool call outlasts that margin.

## Dashboard and cost

The run traces back the agent dashboard (`runtime/analytics.ts`) at
`GET /teams/:teamId/agent-analytics`. Over the last `days` days it returns runs and errors by agent
and project, tokens and cost by model, agent, project and day, and calls by model. `previous` holds
the totals of the same span before it.

The team's owner and managers read every project of the team, and so does anyone whose workspace
role grants `agent_usage` `read`, which covers a workspace owner and admin. Anyone else reads the
projects where their project role grants it (`projectsWithPermission` in `shared/access.ts`), since
a role is set per project and a team-wide figure would show the others. The response names those
projects (`readableProjects`), and `projectId` narrows the dashboard to one of them.
`GET /workspaces/:workspaceId/agent-analytics` reads it over every team of a workspace, with the
teams compared, for its owner and its admins.

The api applies the cost to the token counts of the `model_inference` spans. Mastra attaches a cost
to its metric events, but `PostgresStore`, the store of `runtime/store.ts`, does not implement
`batchCreateMetrics`, so the exporter drops them. `PostgresStoreVNext` in `@mastra/pg` implements
that call, and the api does not use it. `runtime/model-pricing.ts` prices the spans from the table
`@mastra/observability` bundles (`dist/metrics/pricing-data.json`).

The table's provider ids are the registry `AI_PROVIDERS` mirrors, so a credential's integration key
needs no mapping. A key the table lacks, such as `openai-compatible`, stays unpriced until the
workspace sets a price. The file is outside the package's exports map: a release that moves it
leaves the table empty. An unpriced call reports no cost, and the dashboard shows its tokens without
an amount. A figure that mixes both shows the amount of the priced calls, and the dashboard names
the models with no price.

A workspace sets its own price for any model in `model_price`, which the dashboards of its teams
read before the table (`ownPrices` in `analytics.ts`). It covers a model the table lacks, such as
one behind an OpenAI-compatible proxy, and one bought at another rate. The cost is worked out when a
dashboard is read, so a price also recounts past calls whose traces are still stored.

`modules/agents/prices` lets the workspace's owner and admins read and set those prices. It lists
the models the workspace called in the last 90 days or priced, those no price covers first, and the
whole table, paged, each beside the workspace's own price.

## Reading runs

`GET /issues/:issueId/agent-runs` reads an issue's runs with cursor pagination. It requires
`work_items read` and `ai_agents read` in the issue's current project.

A run keeps its original project. Moving an issue cancels the pending runs of the issue and its
subtasks. The issue panel, the trace routes and every queue then hide the moved issue's runs from
everyone, members of the original project included, so a moved issue does not expose its former
project's prompts or traces. The agent's run history (`GET /teams/:teamId/ai-agents/:agentId/runs`)
has no such filter: members of the original project and whoever runs the team still read those runs
there.

Three routes read a run's trace:

- `GET /issues/:issueId/agent-runs/:runId/trace` reads the Mastra trace of an internal run: the
  latest recorded attempt, or the one named by `traceId`. Each trace links to the previous recorded
  attempt (`previousTraceId`). It returns null for a missing latest trace and for an external run,
  which has no Mastra trace. An unknown or unrelated `traceId` returns 404.
- `GET /agent-runs/:runId/internal-trace` reads the same trace by the run alone, and takes the same
  `traceId`.
- `GET /agent-runs/:runId/trace?attempt=N` reads the transcript an external runner reported. The
  latest recorded attempt is the default.

The issue route requires both read permissions in the issue's current project. The two
`/agent-runs/:runId` routes require them in the run's original project, and `documents read` for a
run started in a document. Whoever runs the team needs none of them there. A run from a private
document is read only by the document's owner. These two routes also serve runs without an issue: a
schedule's, a manual run's, and one started in a document comment.

The api stores the events an external runner reports in `agent_run_trace`, one row per attempt:
messages, tool inputs and results, and a local Codex session link. Transcripts follow the instance
trace retention window after the run finishes. Pending runs and final results are retained.

`POST /agent-runs/:runId/events` accepts only the calling agent's current executing, unexpired
attempt. Event offsets deduplicate retries: a fully accepted batch is acknowledged without changes,
and a batch overlapping the accepted prefix appends only its unseen suffix. An offset beyond the
next expected offset is a gap and returns 409. A different session ID is rejected even for a
replayed batch. An attempt's transcript stops recording after 2,000 events or 1 MB. Acknowledgements
continue, so the runner can still report its final result. A Codex UUID forms the local
`codex://threads/` link, and no supplied URL is accepted.

The runner sends the attempt number on heartbeat and result calls. The api answers 404 to the
process of a reclaimed attempt, and its command keeps running until it ends. `attempt` is optional
on both calls: a custom invocation endpoint can leave it out, and the api then does not check it.

## Runner queue

`GET /agent-runs/queue` pages the active and past runs of internal and external agents across the
caller's readable projects, including archived projects. It requires `work_items read` and
`ai_agents read` in each project, and `documents read` for a run started in a document. `runId`
narrows it to one authorized run for the detail pane.

The same queue is narrowed to a project (`/projects/:projectKey/agent-runs/queue`), a team
(`/teams/:teamId/...`) or a workspace (`/workspaces/:workspaceId/...`). The team's queue is for
whoever runs the team and the workspace managers, the workspace's for its owner and admins. Whoever
runs the team also reads the project queues of its projects without a role there.
`GET /agent-runs/queue` still takes a role.

Each of the three scopes also answers `.../agent-runs/in-flight`: the workspace's limit and the
internal runs holding a slot in the workspace. A run in retry backoff holds a slot, so this count
can differ from the queue's `running` count.

## Concurrency limits

Two limits hold the runs of internal agents in flight. An external agent's run counts against
neither.

- The instance's: `maxConcurrentRuns` in the god mode agent settings, 5 by default, 0 for none.
  `claimDueRuns` applies it under an advisory lock, so api replicas take only the free slots between
  them. It counts only the runs the api has claimed (`claimed_at`) under a valid lease. A deferred
  run and one in retry backoff leave their slot to the other workspaces.
- A workspace's: `workspace.max_concurrent_runs`, set by its owner up to the instance's limit,
  lowered by `setLimitsProvider`. The poller applies it and defers a claimed run past it. Here a run
  in retry backoff keeps its slot whatever its id. Among claims waiting for admission the lower id
  goes first.

## Execution state

The stored `status` stays `pending` while a run waits and while it is claimed. `executionState` is
`running` only after admission succeeds and while the lease is valid. It is `queued` during delays,
retry backoff and after lease expiry. Terminal states keep their names.

`execution_started_at` is cleared on claim, defer, retry, completion and cancel, and set before
execution is handed out. A heartbeat sets it on a started external run that has none, unless the run
has a `last_error`. A run in retry backoff has one, so its heartbeat answers 404.

## Sync marker

`runnerQueue:1` is a user-scoped sync marker. It combines the `runner-queue:` revisions of the
projects a queue may list to the user, those of the teams they run included, with lease expiry,
runner presence and the internal runs in flight in those projects' workspaces. Time-based state
changes are visible without a write. The queue, the issue run panel, the agent's run list and the
trace views watch it. A runner being online is separate from a run holding an execution lease.

The `agent_run_rev` trigger bumps `runner-queue:<projectId>` on every write to `agent_run`, and
`appendRunEvents` bumps it for a transcript write. The trigger does not write the issue scope, so the
issue run panel watches this marker as well as its own scope.
