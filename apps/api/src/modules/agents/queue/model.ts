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
      runnerState: t.Union([
        t.Literal('push'),
        t.Literal('online'),
        t.Literal('offline'),
        t.Literal('never'),
      ]),
    }),
  ).properties,
  queued: t.Number(),
  running: t.Number(),
});
