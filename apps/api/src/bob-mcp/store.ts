import { agentRun, aiAgent, db, issue, projectColumn } from '@repo/db';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getAgentRunStats, getStats, listAgentRunFeed } from '../analytics/store';
import { listBraindumpEntries, type BraindumpKind } from '../braindump/store';
import { listCompetitorEvents, listCompetitors } from '../competitors/store';
import { listMindFacts, type MindCategory, type MindStatus } from '../mind/store';
import { iso } from '../shared/lib';
import type { BobContext } from './identity';
import { BobMcpError } from './security';

function summary(value: string): string {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

export function listScopedProjects(
  context: BobContext,
  filters: { status?: 'active'; search?: string; page: number; pageSize: number },
) {
  const project = context.project;
  const matchesSearch =
    !filters.search ||
    project.name.toLowerCase().includes(filters.search.toLowerCase()) ||
    project.key.toLowerCase().includes(filters.search.toLowerCase());
  const all = matchesSearch
    ? [
        {
          id: project.id,
          key: project.key,
          name: project.name,
          customerName: null,
          status: 'active' as const,
          createdAt: project.createdAt,
          updatedAt: null,
          summary: summary(project.description),
        },
      ]
    : [];
  const offset = (filters.page - 1) * filters.pageSize;
  return {
    items: all.slice(offset, offset + filters.pageSize),
    page: filters.page,
    pageSize: filters.pageSize,
    total: all.length,
  };
}

export async function getScopedProject(context: BobContext, projectId: number) {
  if (projectId !== context.project.id) {
    throw new BobMcpError('not_found', 'Resource not found');
  }
  const tasks = await db
    .select({
      id: issue.id,
      sequenceNumber: issue.sequenceNumber,
      title: issue.title,
      priority: issue.priority,
      status: projectColumn.name,
      stateType: projectColumn.stateType,
      dueDate: issue.dueDate,
      updatedAt: issue.updatedAt,
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.projectId, context.project.id), sql`${issue.archivedAt} is null`))
    .orderBy(desc(issue.updatedAt), desc(issue.id))
    .limit(20);
  return {
    id: context.project.id,
    key: context.project.key,
    name: context.project.name,
    status: 'active' as const,
    summary: summary(context.project.description),
    createdAt: context.project.createdAt,
    tasks: tasks.map((task) => ({ ...task, updatedAt: iso(task.updatedAt) })),
  };
}

// Reads only this project's own tables. Lead data is deliberately absent: Bob is
// not given it, and depending on the external leads database would make the
// summary fail whenever that database is unreachable.
export async function getDashboardSummary(context: BobContext) {
  const [stats, runStats, recentRuns] = await Promise.all([
    getStats(context.project.id),
    getAgentRunStats(context.project.id, 30),
    listAgentRunFeed(context.project.id, { limit: 10 }),
  ]);
  return {
    activeProjects: 1,
    openTasks: stats.open,
    agentRuns: runStats,
    recentAgentRuns: recentRuns.map(({ lastError: _lastError, ...run }) => ({
      ...run,
      errorCode: run.status === 'failed' ? 'agent_run_failed' : null,
    })),
    recentErrors: recentRuns
      .filter((run) => run.status === 'failed')
      .slice(0, 5)
      .map((run) => ({ runId: run.id, errorCode: 'agent_run_failed', createdAt: run.createdAt })),
  };
}

export interface BobPageFilters {
  page: number;
  pageSize: number;
}

// Bob's list tools page over an already-bounded read. Slicing here keeps one
// bounding rule per feature instead of a second, divergent one per tool.
function paginate<T>(rows: T[], filters: BobPageFilters) {
  const offset = (filters.page - 1) * filters.pageSize;
  const items = rows.slice(offset, offset + filters.pageSize);
  return {
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: offset + items.length < rows.length,
  };
}

const TASK_WINDOW = 500;

export interface BobTaskFilters extends BobPageFilters {
  stateType?: string;
  priority?: string;
  search?: string;
  includeArchived?: boolean;
}

// The columns Bob is given: enough to reason about what is open, urgent or late,
// without descriptions, assignees or any other free text he does not need.
const taskColumns = {
  id: issue.id,
  sequenceNumber: issue.sequenceNumber,
  title: issue.title,
  priority: issue.priority,
  status: projectColumn.name,
  stateType: projectColumn.stateType,
  dueDate: issue.dueDate,
  startDate: issue.startDate,
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
};

export async function listScopedTasks(context: BobContext, filters: BobTaskFilters) {
  const where = [eq(issue.projectId, context.project.id)];
  if (!filters.includeArchived) where.push(sql`${issue.archivedAt} is null`);
  if (filters.stateType) where.push(eq(projectColumn.stateType, filters.stateType));
  if (filters.priority) where.push(eq(issue.priority, filters.priority));
  if (filters.search) {
    where.push(sql`${issue.title} ilike ${`%${filters.search}%`}`);
  }
  const rows = await db
    .select(taskColumns)
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(...where))
    // Stable: updatedAt can tie, so the id breaks it.
    .orderBy(desc(issue.updatedAt), desc(issue.id))
    .limit(TASK_WINDOW);
  const items = rows.map((task) => ({
    ...task,
    identifier: `${context.project.key}-${task.sequenceNumber}`,
    createdAt: iso(task.createdAt),
    updatedAt: iso(task.updatedAt),
  }));
  return paginate(items, filters);
}

export async function getScopedTask(context: BobContext, taskId: number) {
  const rows = await db
    .select(taskColumns)
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.id, taskId), eq(issue.projectId, context.project.id)))
    .limit(1);
  const task = rows[0];
  // A task in another project is reported as missing rather than forbidden, so the
  // response never confirms that the id exists somewhere else.
  if (!task) throw new BobMcpError('not_found', 'Resource not found');
  return {
    ...task,
    identifier: `${context.project.key}-${task.sequenceNumber}`,
    createdAt: iso(task.createdAt),
    updatedAt: iso(task.updatedAt),
  };
}

export interface BobBraindumpFilters extends BobPageFilters {
  kind?: BraindumpKind;
  days?: number;
  search?: string;
}

export async function listScopedBraindump(context: BobContext, filters: BobBraindumpFilters) {
  const rows = await listBraindumpEntries(context.project.id, {
    kind: filters.kind,
    days: filters.days ?? 30,
    search: filters.search,
  });
  const items = rows.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    body: summary(entry.body),
    tags: entry.tags,
    pinned: entry.pinned,
    routedTo: entry.routedTo,
    routedRef: entry.routedRef,
    createdAt: entry.createdAt,
  }));
  return paginate(items, filters);
}

export interface BobMindFilters extends BobPageFilters {
  category?: MindCategory;
  status?: MindStatus;
  search?: string;
}

export async function listScopedMindFacts(context: BobContext, filters: BobMindFilters) {
  const rows = await listMindFacts(context.project.id, {
    category: filters.category,
    status: filters.status,
    search: filters.search,
  });
  const items = rows.map((fact) => ({
    id: fact.id,
    category: fact.category,
    title: fact.title,
    body: summary(fact.body),
    tags: fact.tags,
    pinned: fact.pinned,
    status: fact.status,
    confidence: fact.confidence,
    updatedAt: fact.updatedAt,
  }));
  return paginate(items, filters);
}

export async function listScopedCompetitors(context: BobContext, filters: BobPageFilters) {
  const rows = await listCompetitors(context.project.id);
  const items = rows.map((item) => ({
    id: item.id,
    platform: item.platform,
    handle: item.handle,
    label: item.label,
    active: item.active,
    followers: item.latest?.followers ?? null,
    followerChange7d: item.followerChange7d,
    latestPostAt: item.latest?.latestPostAt ?? null,
    lastCheckedAt: item.lastCheckedAt,
    // The reason a check failed stays server-side; Bob only needs to know that it did.
    healthy: item.consecutiveFailures === 0 && item.latest != null,
  }));
  return paginate(items, filters);
}

const COMPETITOR_ALERT_WINDOW = 200;

export async function listScopedCompetitorAlerts(context: BobContext, filters: BobPageFilters) {
  const rows = await listCompetitorEvents(context.project.id, COMPETITOR_ALERT_WINDOW);
  const items = rows.map((event) => ({
    id: event.id,
    platform: event.platform,
    handle: event.handle,
    kind: event.kind,
    summary: event.summary,
    postUrl: event.postUrl,
    readAt: event.readAt,
    createdAt: event.createdAt,
  }));
  return paginate(items, filters);
}

export async function listScopedAgentRuns(
  context: BobContext,
  filters: {
    agentType?: 'external' | 'internal';
    status?: 'pending' | 'success' | 'failed';
    since?: string;
    page: number;
    pageSize: number;
  },
) {
  const conditions = [eq(aiAgent.projectId, context.project.id)];
  if (filters.agentType) conditions.push(eq(aiAgent.kind, filters.agentType));
  if (filters.status) conditions.push(eq(agentRun.status, filters.status));
  if (filters.since) conditions.push(gte(agentRun.createdAt, new Date(filters.since)));
  const offset = (filters.page - 1) * filters.pageSize;
  const rows = await db
    .select({
      id: agentRun.id,
      type: aiAgent.kind,
      agentName: aiAgent.username,
      status: agentRun.status,
      trigger: agentRun.trigger,
      startedAt: agentRun.startedAt,
      finishedAt: agentRun.finishedAt,
      createdAt: agentRun.createdAt,
      attempts: agentRun.attempts,
    })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .where(and(...conditions))
    .orderBy(desc(agentRun.id))
    .limit(filters.pageSize + 1)
    .offset(offset);
  const hasMore = rows.length > filters.pageSize;
  return {
    items: rows.slice(0, filters.pageSize).map((run) => ({
      ...run,
      phase: run.status === 'pending' ? 'queued' : 'completed',
      startedAt: run.startedAt ? iso(run.startedAt) : iso(run.createdAt),
      finishedAt: run.finishedAt ? iso(run.finishedAt) : null,
      processed: null,
      errorCode: run.status === 'failed' ? 'agent_run_failed' : null,
      retryStatus: run.status === 'failed' && run.attempts < 3 ? 'eligible' : 'not_scheduled',
      reconciliationStatus: 'not_required',
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore,
  };
}
