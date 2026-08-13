import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import {
  ActivityPage,
  AgentRunFeedListResponse,
  AgentRunStatsDto,
  AgentWorkloadListResponse,
  BreakdownListResponse,
  PulseListResponse,
  StatsDto,
  ThroughputListResponse,
  WebhookStatsDto,
  activityQuery,
  agentRunFeedQuery,
  breakdownQuery,
  daysQuery,
  pulseQuery,
  throughputQuery,
} from './model';
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
  type PulseUnit,
} from './service';

// Read-only project analytics that back the dashboard widgets. Every route is
// under /projects/:projectKey/analytics and gated by the dashboards read
// permission (the analytics feed the dashboards). All figures come from existing
// tables; see service.ts.

// Caps the generated bucket axis per unit. Hour columns hold 24 cells each, so
// their cap is the lowest.
const MAX_PULSE_COLUMNS: Record<PulseUnit, number> = {
  hour: 140,
  day: 160,
  week: 130,
};

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
      response: { 200: StatsDto, ...accessErrors },
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
      query: breakdownQuery,
      permission: ['dashboards', 'read'],
      response: { 200: BreakdownListResponse, ...commonErrors },
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
      const columns =
        query.columns != null ? Math.min(Math.max(query.columns, 1), MAX_PULSE_COLUMNS[unit]) : 26;
      return getPulse(project.id, unit, columns);
    },
    {
      query: pulseQuery,
      permission: ['dashboards', 'read'],
      response: { 200: PulseListResponse, ...commonErrors },
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
      query: throughputQuery,
      permission: ['dashboards', 'read'],
      response: { 200: ThroughputListResponse, ...commonErrors },
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
      query: activityQuery,
      permission: ['dashboards', 'read'],
      response: { 200: ActivityPage, ...commonErrors },
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
      query: agentRunFeedQuery,
      permission: ['dashboards', 'read'],
      response: { 200: AgentRunFeedListResponse, ...commonErrors },
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
      query: daysQuery,
      permission: ['dashboards', 'read'],
      response: { 200: AgentRunStatsDto, ...commonErrors },
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
      query: daysQuery,
      permission: ['dashboards', 'read'],
      response: { 200: WebhookStatsDto, ...commonErrors },
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
      response: { 200: AgentWorkloadListResponse, ...accessErrors },
      detail: {
        summary: 'Get agent workload',
        description: 'Per-agent open delegated issues and run outcomes.',
        ...mcpTool('get_agent_workload'),
      },
    },
  );
