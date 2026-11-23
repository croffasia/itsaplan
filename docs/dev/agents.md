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
checks itself (`verify` in its folder of `@repo/agent-tools`), and so does a service an extension
adds through `setExtraIntegrations`; one without `verify` cannot be checked (`unknown`). An AI provider is asked for
`/models` at the address in Mastra's registry, or at the credential's base URL; the providers whose
address only their SDK holds, and the few with another request or refusal status, are listed by
hand in `integrations/provider-check.ts`.

A configured tool is bound to one credential of its integration, or to none when the integration
has no credential fields (PDF). An integration marked `credentialOptional` (Keenable) takes both: a
team can add its tools with no key, on the service's keyless tier, and again on a key.

An integration another edition of the app runs (Exa) is listed locked (`LOCKED_INTEGRATIONS` in
`@repo/agent-tools`): the catalog shows what it is and its tools, marked as coming with Cloud and
Pro, and the API refuses a credential or a configured tool of it. Once that edition adds an
integration with its key through `setExtraIntegrations`, the catalog lists that integration
instead. A tool added while it ran stays, named by the listing, and goes to no agent.

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

## Answer length limit

`maxAnswerChars` in the same setting is how many characters of an agent's answer are saved:
200,000 by default, 0 for none. It applies to the output of every run, internal or external, and to
an external agent's chat reply. The start of the answer is kept: `agents/core/answer-limit.ts` cuts
it with Postgres `left()`, which counts characters. The limit does not apply to Mastra's memory
tables, which hold an internal agent's chat.

## Dashboard and cost

The run traces back the agent dashboard (`runtime/analytics.ts`) at
`GET /teams/:teamId/agent-analytics`. Over the last `days` days it returns runs and errors by agent
and project, tokens and cost by model, agent, project and day, and calls by model. `previous` holds
the totals of the same span before it.

The team's owner and managers read every project of the team, and so does anyone whose workspace
role grants `agent_usage` `read`, which covers a workspace owner and admin. Anyone else reads the
projects where their project role grants it (`projectsWithPermission` in `shared/access.ts`), since
a role is set per project and a team-wide figure would show the others. The response names those
projects (`readableProjects`), and `projectIds` narrows the dashboard to some of them.
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

## API runs

`POST /projects/:projectKey/ai-agents/:agentId/run` (MCP `run_ai_agent`) queues its prompt as a run
with the trigger `api`, as a schedule queues its task: no issue, document or schedule, and a thread
of its own (`run:<id>`). It works for internal and external agents, through a runner or an
invocation URL alike, and the run shows in the queue and the agent's run history. It is checked as
a chat message is: chat on, the runner scope, and the run refusal hook for an internal agent.
The sender is the initiator of the run (see "Run initiator").

The route answers 202 at once, so a long run outlasts neither a proxy's read timeout nor an MCP
client's request timeout. `GET /agent-runs/:runId` (MCP `get_agent_run`) reads the status, then the
answer or the error, and while the run waits or runs `retryAfterSeconds` (`pollAfterSeconds` in
`run-queue.ts`): 10 s while it is queued, a quarter of its running time within 5–30 s, or the time
to its retry within the same bounds.

## Run initiator

The initiator is the person a run works for. `agent_run.requested_by_user_id` stores it. Null means
the run is the project's work. The initiator is never an agent.

| The run starts when                                       | Initiator                                  |
| --------------------------------------------------------- | ------------------------------------------ |
| a person mentions the agent in a comment                  | the person                                 |
| a person replies to a comment of the agent                | the person                                 |
| a person edits a comment and adds a mention of the agent  | the person who edits                       |
| a person delegates an issue to the agent                  | the person                                 |
| a person sets the agent in a member field                 | the person                                 |
| a person sends the agent an API task                      | the person                                 |
| a schedule starts                                         | null                                       |
| another agent starts it (see below)                       | the initiator of that agent's run or chat  |

Agent A starts a run of agent B when A delegates an issue to B, sets B in a member field or sends B
an API task. A comment of an agent starts no run. The run of B gets the initiator of the work A does
at that time:

1. A is an internal agent in a queued run: the initiator of that run.
2. A is an internal agent in a chat: the initiator of that chat. When a person writes in the chat,
   that person is the initiator. When an agent writes, the chat gets the initiator of that agent's
   work, by this list.
3. A is an external agent: the initiator of the run its MCP call names in the `X-Itsaplan-Run-Id`
   header. The runner sets that id for the command (`ITSAPLAN_RUN_ID`), and the agent's MCP config
   sends it (see [Coding agent setup](../runner.md)). The api takes the run only when it is A's and
   in the `running` execution state.
4. Any other call of A: null. This is a call with no run or another run, and a REST call.

The api runs each tool call of an agent in its work (`actFor` in `run-initiator.ts`). Thus each run
in a chain of agents has the initiator of the first run. The api never takes the initiator from the
request.

The initiator has two uses:

- The claim tells the agent who asked. When the initiator wrote the comment that started the run,
  it gives the name that comment showed. Otherwise it gives the user name of the initiator.
- The run refusal hook gets the initiator: when an API task is queued, when a run starts and for
  each chat message.

## Run origin

A run records whom it works for, who started it and in which run. With these, a reader follows a
chain of agent runs back to its first run.

- `requested_by_user_id`: the initiator, the person the run works for (see "Run initiator").
- `started_by_user_id`: the person or the agent that started the run. When a change started it, such
  as a move of an issue into the status a schedule waits for, it is who made the change. Null for a
  timed schedule.
- `parent_run_id`: the run in which the agent started this run. Null when a person, a timed schedule
  or an agent in a chat started it.
- `root_run_id`: the first run of the chain. Null when the run has no parent.

The api finds the agent's run by the same rules as the initiator.

## Reading and stopping runs

A reader sees a run in two parts:

- The answer: the status, the task and the result.
- The steps: what the agent did. For an internal agent, this is its Mastra trace. For an external
  agent, this is the transcript its runner reported.

Whoever runs the team reads both. Any other reader needs `ai_agents read` in the run's project for
the answer. For the steps, the reader also needs one of these:

- The reader owns the project.
- The reader can create or change agents in the project (`ai_agents create` or `edit`).
- The reader is the run's initiator.

The same people can stop a run that waits or works. The run becomes `canceled` at once, and the api
sends `agent_run.finished` with the person who stopped it as the actor. The run records that person
or agent in `canceled_by_user_id`. Ending the pending runs of a schedule records who ended them too.
The field stays null when the run ended by itself or when the api ended it, as when its issue moved
to another column or project. An internal agent at work checks its run every 5 seconds and then
stops its model call and its tools. An external runner learns of the stop when its heartbeat or
events call answers `canceled: true`. Then it kills its command and reports nothing more.

Two rules hide a run:

- A run keeps its original project. When its issue moves to another project, the readers there must
  not see the prompts and traces of the old project. Thus the move cancels the pending runs of the
  issue and its subtasks, and the issue panel, the trace routes and every queue hide the issue's runs
  from everyone. The agent's run history (`GET /teams/:teamId/ai-agents/:agentId/runs`) still shows
  them to the members of the original project and to whoever runs the team.
- Only the document's owner reads a run from a private document.

| Route                                                   | Gives                                             | Who reads                                      |
| ------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `GET /issues/:issueId/agent-runs`                       | the issue's runs with their answers, newest first | the answer rule in the issue's current project |
| `GET /issues/:issueId/agent-runs/:runId/trace`          | the trace of an internal run on the issue         | the steps rule in the issue's current project  |
| `GET /agent-runs/:runId`                                | the answer of one run                             | the answer rule                                |
| `GET /agent-runs/:runId/internal-trace`                 | the trace of an internal run                      | the steps rule                                 |
| `GET /agent-runs/:runId/trace`                          | the transcript of an external run                 | the steps rule                                 |
| `POST /agent-runs/:runId/cancel`                        | stops a run that waits or works                   | the steps rule                                 |
| `GET /teams/:teamId/ai-agents/:agentId/traces/:traceId` | one trace of the agent                            | for the trace of a queued run, the steps rule  |

The `/agent-runs/:runId` routes also read and stop runs without an issue: the run of a schedule, a
manual run, an API run and a run from a document comment.

## External run transcripts

An external agent takes an attempt of a run when its runner claims it, or when its invocation
endpoint answers the request with a 2xx or does not answer in time. The first attempt it takes sets
`received_at` on the run and records `agent_started` on the issue. An attempt the endpoint refused
sets neither, so a run that the agent never received has no `received_at`. The run payloads give it
as `receivedAt`, and the run's steps then say that the agent did not receive the run.

The api stores what an external runner reports in `agent_run_trace`, one row for each attempt: the
messages, the tool inputs and results, and a link to the local Codex session. After the run ends,
the api keeps the transcript for the instance's trace retention window. It keeps the transcripts of
pending runs and the final results.

`POST /agent-runs/:runId/events` takes events only for the current attempt of the calling agent,
while that attempt runs and has not expired. The offset of each event stops a repeated batch from
adding copies:

- A batch the api already took gets an acknowledgement and changes nothing.
- A batch that overlaps the events already taken adds only its new events.
- A batch that starts after the next expected offset leaves a gap and gets 409.
- A batch with another session ID gets 409, also when it repeats a batch.

The api stops recording the transcript of an attempt at 2,000 events or 1 MB. It continues to
acknowledge the events, so the runner can still report its final result. The api makes the link
`codex://threads/<id>` from the Codex session UUID and accepts no URL from the runner.

The runner sends the attempt number on heartbeat and result calls. After a new claim of the run, the
api answers 404 to the process of the old attempt. The command of that process continues until it
ends. `attempt` is optional on both calls: a custom invocation endpoint can omit it, and then the api
does not check it.

## Run list

The run list is the Agent runs page of the web app: the runs of internal and external agents, the
active and the past ones. Each route gives the list of one scope:

| Route                                           | Runs of                                             | Who reads                                                 |
| ----------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `GET /agent-runs/queue`                         | every project where the caller has `ai_agents read` | anyone signed in                                          |
| `GET /projects/:projectKey/agent-runs/queue`    | the project                                         | `ai_agents read` in the project, or whoever runs the team |
| `GET /teams/:teamId/agent-runs/queue`           | the team's projects                                 | whoever runs the team or manages its workspace            |
| `GET /workspaces/:workspaceId/agent-runs/queue` | the projects of every team of the workspace         | the workspace's owner and admins                          |

The list includes archived projects. It hides the runs that "Reading and stopping runs" hides.

Filters:

- `state`: the `active` runs (waiting and running) or the `failed` runs.
- `q`: the issue's title or key, the schedule's name or the agent's username.
- `initiatorIds`, `projectIds`: the runs of these initiators or projects, comma-separated.
- `runId`: one run, for the detail pane.

The filters take their choices from `.../agent-runs/initiators/options`, the initiators of the
list's runs, and, for a team or a workspace, `.../agent-runs/projects/options`, the projects of its
list. Each takes the access of its list.

The answer gives:

- The runs. Each run gives `initiator`, `startedBy`, `parentRun` and `rootRun` (see "Run initiator"
  and "Run origin"), and `canReadSteps` and `canceledBy` by "Reading and stopping runs". A run names
  its issue by key and title and its `document` by id and title, and the parent and the first run by
  id. It names them also when the caller cannot read them: opening one asks again.
- The `queued`, `running` and `failed` counts. They obey every filter but `state`, so each state
  shows how many runs it holds.

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

`GET .../agent-runs/in-flight` of a project, a team or a workspace gives the workspace's limit and
the internal runs that hold a slot. A run in retry backoff holds a slot, so this count can differ
from the `running` count of the run list.

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
