import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { IssueAgentRunPageResponse, issueAgentTraceQuery } from '#modules/issues/model';
import { agentExecutionState } from '../model';

export const queueQuery = t.Object({
  ...pageQueryFields,
  runId: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  state: t.Optional(
    t.Union([t.Literal('failed'), t.Literal('active')], {
      description: "'failed' lists the failed runs; 'active' the waiting and running ones.",
    }),
  ),
  q: t.Optional(
    t.String({
      maxLength: 200,
      description:
        "Text to find in the issue's title or key, the schedule's name or the agent's username.",
    }),
  ),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
});
const run = IssueAgentRunPageResponse.properties.items.items;
export const RunnerQueueResponse = t.Object({
  ...pageResponse(
    t.Object({
      ...run.properties,
      issueId: t.Nullable(t.Number()),
      sequenceNumber: t.Nullable(t.Number()),
      issueTitle: t.Nullable(t.String()),
      scheduleId: t.Nullable(t.Number()),
      scheduleName: t.Nullable(t.String()),
      projectRef: t.String(),
      inputTokens: t.Nullable(t.Number({ description: 'What the last model call read.' })),
      outputTokens: t.Nullable(t.Number({ description: 'What the last model call wrote.' })),
      runnerState: t.Nullable(
        t.Union([t.Literal('push'), t.Literal('online'), t.Literal('offline'), t.Literal('never')]),
        {
          description:
            'How the run reaches its runner; null for an internal agent, which has none.',
        },
      ),
    }),
  ).properties,
  queued: t.Number(),
  running: t.Number(),
  failed: t.Number({ description: 'Failed runs that match `q`, whatever `state` is.' }),
});

export const internalTraceQuery = t.Object({
  ...issueAgentTraceQuery.properties,
  attempt: t.Optional(
    t.Numeric({
      minimum: 1,
      multipleOf: 1,
      description: 'The recorded attempt to read, oldest 1; the latest when absent.',
    }),
  ),
});

export const AgentRunResultResponse = t.Object({
  runId: t.Number(),
  status: agentExecutionState,
  output: t.Nullable(
    t.String({ description: "The agent's answer; the text it had produced for a failed run." }),
  ),
  error: t.Nullable(t.String({ description: 'Why the last attempt failed.' })),
  retryAfterSeconds: t.Optional(
    t.Number({ description: 'Seconds to wait before reading it again; absent once it ended.' }),
  ),
});

export const RunsInFlightResponse = t.Object({
  running: t.Number({
    description: "Runs of the workspace's internal agents in flight; the rest wait in the queue.",
  }),
  limit: t.Number({
    description:
      "The lower of the workspace's own limit and its plan's; 0 when neither is set. The instance's limit, over every workspace, is not in it.",
  }),
});
