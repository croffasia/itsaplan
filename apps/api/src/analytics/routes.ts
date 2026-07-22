import { Elysia, t } from 'elysia';
import { guards } from '../shared/guards';
import { mcpTool } from '../mcp/generate';
import { ErrorResponse } from '../shared/responses';
import {
  getStats,
  getBreakdown,
  getPulse,
  getThroughput,
  listActivity,
  listAgentRunFeed,
  getAgentRunStats,
  getWebhookStats,
  getAgentWorkload,
  type ActivityCursor,
} from './store';

// Issue count stats (StatsDto from the store).
const StatsDto = t.Object({
  open: t.Number(),
  inProgress: t.Number(),
  backlog: t.Number(),
  overdue: t.Number(),
  unassigned: t.Number(),
  closedLast7d: t.Number(),
});

// One breakdown bucket (BreakdownItem from the store).
const BreakdownItem = t.Object({
  key: t.String(),
  label: t.String(),
  count: t.Number(),
  color: t.Nullable(t.String()),
});

// One pulse heatmap cell (PulseBucket from the store).
const PulseBucket = t.Object({
  label: t.String(),
  count: t.Number(),
});

// One throughput week (ThroughputWeek from the store).
const ThroughputWeek = t.Object({
  week: t.String(),
  created: t.Number(),
  closed: t.Number(),
});

// One activity feed entry (ActivityItem from the store).
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
  subject: t.Nullable(t.String()),
  fromText: t.Nullable(t.String()),
  toText: t.Nullable(t.String()),
  createdAt: t.String(),
});

// The keyset cursor for the next activity page (ActivityCursor from the store).
const ActivityCursorDto = t.Object({
  ts: t.String(),
  id: t.Number(),
});

// One page of the activity feed (ActivityPage from the store).
const ActivityPage = t.Object({
  items: t.Array(ActivityItem),
  nextCursor: t.Nullable(ActivityCursorDto),
});

// One agent run in the project-wide feed (AgentRunFeedItem from the store).
const AgentRunFeedItem = t.Object({
  id: t.Number(),
  status: t.String(),
  trigger: t.Union([
    t.Literal('mention'),
    t.Literal('delegation'),
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

// Agent run outcome counts over a window (AgentRunStatsDto from the store).
const AgentRunStatsDto = t.Object({
  total: t.Number(),
  success: t.Number(),
  failed: t.Number(),
  pending: t.Number(),
});

// Webhook delivery health (WebhookStatsDto from the store).
const WebhookStatsDto = t.Object({
  total: t.Number(),
  success: t.Number(),
  failed: t.Number(),
  pending: t.Number(),
  activeWebhooks: t.Number(),
  disabledWebhooks: t.Number(),
});

// One agent's workload row (AgentWorkloadItem from the store).
const AgentWorkloadItem = t.Object({
  agentId: t.Number(),
  agentName: t.String(),
  kind: t.String(),
  delegatedOpen: t.Number(),
  runsTotal: t.Number(),
  runsSuccess: t.Number(),
  runsFailed: t.Number(),
});

// Read-only project analytics that back the dashboard widgets. Every route is
// under /projects/:projectKey/analytics and gated by the dashboards read
// permission (the analytics feed the dashboards). All figures come from existing
// tables; see store.ts.
export const analyticsRoutes = new Elysia({
  name: 'analytics',
  detail: { tags: ['Analytics'] },
})
  .use(guards)
  .get(
    '/projects/:projectKey/analytics/stats',
    async ({ project }) => {
      return getStats(project.id);
    },
    {
      permission: ['dashboards', 'read'],
      response: {
        200: StatsDto,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get project stats',
        description: 'Issue counts by state (open, in progress, overdue, and more).',
        ...mcpTool('get_project_stats'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/breakdown',
    async ({ project, query }) => {
      return getBreakdown(project.id, query.by);
    },
    {
      query: t.Object({
        by: t.Union([
          t.Literal('status'),
          t.Literal('priority'),
          t.Literal('type'),
          t.Literal('assignee'),
          t.Literal('delegate'),
        ]),
      }),
      permission: ['dashboards', 'read'],
      response: {
        200: t.Array(BreakdownItem),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get project breakdown',
        description: 'Issue counts grouped by a chosen dimension.',
        ...mcpTool('get_project_breakdown'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/pulse',
    async ({ project, query }) => {
      const unit = query.unit ?? 'day';
      // Cap columns so the generated bucket axis stays bounded (hour columns hold
      // 24 cells each, so their cap is lower).
      const maxColumns = unit === 'hour' ? 140 : unit === 'week' ? 130 : 160;
      const columns = query.columns != null ? Math.min(Math.max(query.columns, 1), maxColumns) : 26;
      return getPulse(project.id, unit, columns);
    },
    {
      query: t.Object({
        unit: t.Optional(t.Union([t.Literal('hour'), t.Literal('day'), t.Literal('week')])),
        columns: t.Optional(t.Numeric()),
      }),
      permission: ['dashboards', 'read'],
      response: {
        200: t.Array(PulseBucket),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get project pulse',
        description: 'Activity counts over time for a heatmap.',
        ...mcpTool('get_project_pulse'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/throughput',
    async ({ project, query }) => {
      const weeks = query.weeks != null ? Math.min(Math.max(query.weeks, 1), 52) : 12;
      return getThroughput(project.id, weeks);
    },
    {
      query: t.Object({ weeks: t.Optional(t.Numeric()) }),
      permission: ['dashboards', 'read'],
      response: {
        200: t.Array(ThroughputWeek),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get project throughput',
        description: 'Created versus closed issues over time.',
        ...mcpTool('get_project_throughput'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/activity',
    async ({ project, query }) => {
      const limit = query.limit ?? 25;
      let before: ActivityCursor | null = null;
      if (query.cursor) {
        try {
          before = JSON.parse(query.cursor);
        } catch {
          // Ignore a malformed cursor and serve the first page.
        }
      }
      const issueIds =
        query.issueIds != null
          ? query.issueIds
              .split(',')
              .map(Number)
              .filter((n) => Number.isInteger(n))
          : null;
      return listActivity(project.id, {
        before,
        limit,
        actorUserId: query.actorUserId ?? null,
        action: query.action ?? null,
        issueIds,
      });
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        cursor: t.Optional(t.String()),
        actorUserId: t.Optional(t.String()),
        action: t.Optional(t.String()),
        // Comma-separated issue ids the client resolved from the widget's work items
        // filter; absent means no issue-scope restriction.
        issueIds: t.Optional(t.String()),
      }),
      permission: ['dashboards', 'read'],
      response: {
        200: ActivityPage,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get project activity',
        description: 'Project-wide feed of issue activity.',
        ...mcpTool('get_project_activity'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/agent-runs',
    async ({ project, query }) => {
      const limit = query.limit ?? 20;
      return listAgentRunFeed(project.id, { status: query.status ?? null, limit });
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([t.Literal('pending'), t.Literal('success'), t.Literal('failed')]),
        ),
        limit: t.Optional(t.Numeric()),
      }),
      permission: ['dashboards', 'read'],
      response: {
        200: t.Array(AgentRunFeedItem),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'List agent runs',
        description: 'Project-wide feed of agent runs.',
        ...mcpTool('list_agent_runs'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/agent-run-stats',
    async ({ project, query }) => {
      const days = query.days != null ? Math.min(Math.max(query.days, 1), 90) : 30;
      return getAgentRunStats(project.id, days);
    },
    {
      query: t.Object({ days: t.Optional(t.Numeric()) }),
      permission: ['dashboards', 'read'],
      response: {
        200: AgentRunStatsDto,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get agent run stats',
        description: 'Agent run outcome counts (success, failed, pending).',
        ...mcpTool('get_agent_run_stats'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/webhook-stats',
    async ({ project, query }) => {
      const days = query.days != null ? Math.min(Math.max(query.days, 1), 90) : 30;
      return getWebhookStats(project.id, days);
    },
    {
      query: t.Object({ days: t.Optional(t.Numeric()) }),
      permission: ['dashboards', 'read'],
      response: {
        200: WebhookStatsDto,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get webhook stats',
        description: 'Webhook delivery outcomes and active/disabled webhook counts.',
        ...mcpTool('get_webhook_stats'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/agent-workload',
    async ({ project }) => {
      return getAgentWorkload(project.id);
    },
    {
      permission: ['dashboards', 'read'],
      response: {
        200: t.Array(AgentWorkloadItem),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get agent workload',
        description: 'Per-agent open delegated issues and run outcomes.',
        ...mcpTool('get_agent_workload'),
      },
    },
  );
