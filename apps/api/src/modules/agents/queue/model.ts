import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { IssueAgentRunPageResponse } from '#modules/issues/model';

export const queueQuery = t.Object({
  ...pageQueryFields,
  runId: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
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
      scheduleName: t.Nullable(t.String()),
      projectRef: t.String(),
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
