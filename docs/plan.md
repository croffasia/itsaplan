# Plan: agent governance

This plan covers controls that let a team limit and inspect what its AI agents do: a
monthly budget per agent, an action audit log per agent, and an approval checkpoint before
an agent writes. All three have shipped.

## Gap evidence

Hosted trackers meter agent usage and bill for it. A self-hosted team that brings its own
model key pays the provider directly, so it needs the limit in the tracker instead.

- Jira: Rovo usage is counted in credits, with overage billing from 3 December 2026.
- Linear: agent usage draws on a credit pool on the Business and Enterprise plans.
- Plane: AI usage is metered on self-hosted instances too.

None of these let a team set a spending limit on one agent in its own currency, against its
own model prices. These points are taken from the vendors' published pricing and should be
re-checked before they are quoted outside this repository.

## 1. Monthly budget per agent (shipped)

An internal agent has an optional monthly budget in US dollars. The cost is the one the
agent dashboard shows, counted from the start of the current UTC month.

User stories:

- As a team admin, I set a monthly budget on an internal agent, so that a misconfigured
  schedule or a long chat cannot spend more than I planned.
- As a team admin, I clear the budget, so that the agent has no limit.
- As a project member, I see why the agent did not answer, so that I do not retry blindly.

Acceptance criteria:

- `monthlyBudgetUsd` is accepted on create and update, is a number of at least 0 or null,
  and is returned in the agent DTO. Null means no limit.
- The budget is stored only for internal agents.
- When the agent's cost since the start of the UTC month is equal to or above the budget, a
  queued run fails without a retry and a chat answer returns 403, both with the reason
  "The agent's monthly budget of $X.XX is spent".
- The check runs before any other run refusal.
- On the first day of the next UTC month the agent runs again with no action.

## 2. Action audit log per agent (shipped)

User stories:

- As a team admin, I open an agent and see every write it made: the action, the issue or
  comment it changed, the run it came from, and the time.
- As a team admin, I filter the log by project and by date range.

Acceptance criteria:

- Every tool call that creates, updates, or deletes an entity during a run adds one row,
  linked to the agent and the run.
- A read-only tool call adds no row.
- The log is visible to the team owner and admins only, and follows the same project
  permissions as the agent dashboard.
- A failed write is recorded with its error.

Implementation: `agent_action_log` holds one row per write call of an agent: a mutating
route call or a call of an integration tool marked `writes` in `@repo/agent-tools`, made
in a run or a chat; a mutating call an agent makes through the MCP endpoint with its own
key, when the call names a project or an issue; and a held call once an approval applies
it, with the approver. The list is `GET /teams/:teamId/ai-agents/:agentId/actions`, with
`projectId`, `from` and `to`.

## 3. Approval checkpoint before a write (shipped)

User stories:

- As a team admin, I mark chosen write actions of an agent as needing approval, so that a
  person confirms them before they apply.
- As an approver, I see the pending action with its proposed change and approve or reject
  it.

Acceptance criteria:

- An action marked for approval does not apply during the run. The run records it as
  pending and the agent is told the action awaits approval.
- An approval applies the change as the agent, and the audit log records the approver.
- A rejection applies nothing, and the agent's next run sees the rejection.
- A pending action that is not decided within a set time expires and applies nothing.
- Actions not marked for approval behave as before.

Implementation: approval is one switch per internal agent (`requireApproval`), which holds
every mutating route call and every integration tool call. A held call is stored in
`agent_pending_action`. One not decided within 7 days is marked `expired` before any list
or decision reads it. The approved, rejected, failed and expired calls the agent has not
seen are added to the instructions of its next run in that project, once.
