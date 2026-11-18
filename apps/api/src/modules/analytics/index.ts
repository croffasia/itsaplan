import { Elysia } from 'elysia';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { guards } from '#shared/guards';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import { instantParam } from '#shared/lib';
import {
  ActivityPage,
  AgentRunFeedListResponse,
  AgentRunStatsDto,
  AgentWorkloadListResponse,
  BreakdownListResponse,
  BurnupDto,
  PulseListResponse,
  StatsDto,
  ThroughputListResponse,
  WebhookStatsDto,
  activityQuery,
  agentRunFeedQuery,
  breakdownQuery,
  burnupQuery,
  daysQuery,
  pulseQuery,
  throughputQuery,
} from './model';
import {
  getStats,
  getBreakdown,
  getPulse,
  getThroughput,
  getBurnup,
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
  .use(authContext)
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
        description: 'Get issue counts by state: open, in progress, overdue and more.',
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
        description: 'Get issue counts grouped by one dimension.',
        ...mcpTool('get_project_breakdown'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/pulse',
    async ({ project, query, user }) => {
      const unit = query.unit ?? 'day';
      const columns =
        query.columns != null ? Math.min(Math.max(query.columns, 1), MAX_PULSE_COLUMNS[unit]) : 26;
      return getPulse(
        project.id,
        unit,
        columns,
        query.scope === 'me' ? requireUser(user).id : undefined,
      );
    },
    {
      query: pulseQuery,
      permission: ['dashboards', 'read'],
      response: { 200: PulseListResponse, ...commonErrors },
      detail: {
        summary: 'Get project pulse',
        description:
          "Get activity counts over time. scope 'me' counts only " +
          "your actions. 'project' counts all project activity.",
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
        description: 'Get created and closed issue counts over time.',
        ...mcpTool('get_project_throughput'),
      },
    },
  )

  .get(
    '/projects/:projectKey/analytics/burnup',
    async ({ project, query }) => {
      const days = query.days != null ? Math.min(Math.max(query.days, 7), 730) : 90;
      const forecastWeeks =
        query.forecastWeeks != null ? Math.min(Math.max(query.forecastWeeks, 1), 12) : 4;
      return getBurnup(project.id, {
        days,
        initiativeId: query.initiativeId ?? null,
        forecastWeeks,
      });
    },
    {
      query: burnupQuery,
      permission: ['dashboards', 'read'],
      response: { 200: BurnupDto, ...commonErrors },
      detail: {
        summary: 'Get project burnup',
        description:
          'Get scope, started and completed issue counts at the end of each day, with a ' +
          'completion date forecast from the recent closing rate ' +
          'and scope growth. initiativeId limits it to one initiative.',
        ...mcpTool('get_project_burnup'),
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
        from: instantParam('from', query.from),
        to: instantParam('to', query.to),
      });
    },
    {
      query: activityQuery,
      permission: ['dashboards', 'read'],
      response: { 200: ActivityPage, ...commonErrors },
      detail: {
        summary: 'Get project activity',
        description:
          "Get the project's issue activity feed, newest first: " +
          'comments and changes such as creation and state moves.',
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
        description: "List the project's agent runs.",
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
        description: 'Count agent runs by outcome: success, failed, pending.',
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
        description: 'Get webhook delivery outcomes and counts of active and disabled webhooks.',
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
        description: "Get each agent's open delegated issues and run outcomes.",
        ...mcpTool('get_agent_workload'),
      },
    },
  );
