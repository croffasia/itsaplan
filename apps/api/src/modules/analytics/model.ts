import { t } from 'elysia';
import { ActivityPayloadResponse } from '#shared/activity';

export const StatsDto = t.Object({
  open: t.Number(),
  inProgress: t.Number(),
  backlog: t.Number(),
  overdue: t.Number(),
  unassigned: t.Number(),
  closedLast7d: t.Number(),
});

const BreakdownItem = t.Object({
  key: t.String(),
  label: t.String(),
  count: t.Number(),
  color: t.Nullable(t.String()),
});

const PulseBucket = t.Object({
  label: t.String(),
  count: t.Number(),
});

const ThroughputWeek = t.Object({
  week: t.String(),
  created: t.Number(),
  closed: t.Number(),
});

const ActivityItem = t.Object({
  id: t.Number(),
  issueId: t.Number(),
  issueSequence: t.Number(),
  issueTitle: t.String(),
  kind: t.String(),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  body: t.Nullable(t.String()),
  action: t.Nullable(t.String()),
  payload: ActivityPayloadResponse,
  createdAt: t.String(),
});

const ActivityCursorDto = t.Object({
  ts: t.String(),
  id: t.Number(),
});

export const ActivityPage = t.Object({
  items: t.Array(ActivityItem),
  nextCursor: t.Nullable(ActivityCursorDto),
});

const AgentRunFeedItem = t.Object({
  id: t.Number(),
  status: t.String(),
  trigger: t.Union([
    t.Literal('mention'),
    t.Literal('delegation'),
    t.Literal('field'),
    t.Literal('schedule'),
    t.Literal('manual'),
  ]),
  agentId: t.Number(),
  agentName: t.String(),
  issueId: t.Nullable(t.Number()),
  issueSequence: t.Nullable(t.Number()),
  lastError: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const AgentRunStatsDto = t.Object({
  total: t.Number(),
  success: t.Number(),
  failed: t.Number(),
  pending: t.Number(),
});

export const WebhookStatsDto = t.Object({
  total: t.Number(),
  success: t.Number(),
  failed: t.Number(),
  pending: t.Number(),
  activeWebhooks: t.Number(),
  disabledWebhooks: t.Number(),
});

const AgentWorkloadItem = t.Object({
  agentId: t.Number(),
  agentName: t.String(),
  kind: t.String(),
  delegatedOpen: t.Number(),
  runsTotal: t.Number(),
  runsSuccess: t.Number(),
  runsFailed: t.Number(),
});

export const BreakdownListResponse = t.Array(BreakdownItem);

export const PulseListResponse = t.Array(PulseBucket);

export const ThroughputListResponse = t.Array(ThroughputWeek);

export const AgentRunFeedListResponse = t.Array(AgentRunFeedItem);

export const AgentWorkloadListResponse = t.Array(AgentWorkloadItem);

export const breakdownQuery = t.Object({
  by: t.Union([
    t.Literal('status'),
    t.Literal('priority'),
    t.Literal('type'),
    t.Literal('assignee'),
    t.Literal('delegate'),
  ]),
});

export const pulseQuery = t.Object({
  unit: t.Optional(t.Union([t.Literal('hour'), t.Literal('day'), t.Literal('week')])),
  columns: t.Optional(t.Numeric()),
});

export const throughputQuery = t.Object({ weeks: t.Optional(t.Numeric()) });

export const activityQuery = t.Object({
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
  actorUserId: t.Optional(t.String()),
  action: t.Optional(t.String()),
  // Comma-separated issue ids the client resolved from the widget's work items
  // filter; absent means no issue-scope restriction.
  issueIds: t.Optional(t.String()),
});

export const agentRunFeedQuery = t.Object({
  status: t.Optional(t.Union([t.Literal('pending'), t.Literal('success'), t.Literal('failed')])),
  limit: t.Optional(t.Numeric()),
});

export const daysQuery = t.Object({ days: t.Optional(t.Numeric()) });
