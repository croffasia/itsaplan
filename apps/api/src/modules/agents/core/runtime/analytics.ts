import { db, aiAgent, modelPrice, project, team, user } from '@repo/db';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { iso, num } from '#shared/lib';
import { spansTableExists } from './store';
import { estimateCost, priceKey, type CallUsage, type OwnPrices } from './model-pricing';

// The figures behind the agent dashboard, read from the traces the runtime records
// (see observability.ts). One trace is one run: its root span carries the team, the
// agent and the project in metadata, and below it is a `model_inference` span for every
// call the run made to a model, with the provider, the model and the token counts. The
// spans hold no foreign keys of ours, so everything is scoped through that metadata and
// the names are read separately.
//
// The scope is a list of teams: one team, or every team of a workspace. `projectIds`
// narrows it to those projects, for a member who may read only some. The window is
// asked for in days and always read twice: the period itself and the one before it, so
// every headline figure carries what it moved from. Both come back in a single pass over
// the spans, grouped by the bucket each row falls in — an hour for a window of a day, a
// day for anything longer — and split by when the row itself started, since the first
// bucket of a window starts before the window does.
//
// Traces are deleted once past the retention window, so a window longer than the
// retention shows only what is still stored.

// What a group of model calls read, wrote and cost. `cost` is null until a call of the
// group could be priced: the price table names no such provider and model.
interface Usage {
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

export interface AgentAnalyticsTotals extends Usage {
  runs: number;
  errors: number;
}

export interface AgentAnalytics {
  from: string;
  to: string;
  totals: AgentAnalyticsTotals;
  previous: AgentAnalyticsTotals;
  models: (Usage & { provider: string; model: string; calls: number })[];
  agents: (AgentAnalyticsTotals & { agentId: number; name: string })[];
  projects: (AgentAnalyticsTotals & { projectId: number; name: string })[];
  teams: (AgentAnalyticsTotals & { teamId: number; name: string })[];
  tokensPerDay: (Usage & { day: string })[];
}

// The period a dashboard reads and the one before it. A window of a day is grouped by
// the hour, since by the day its chart would hold one or two points.
export interface AnalyticsWindow {
  from: Date;
  to: Date;
  previousFrom: Date;
  bucket: 'hour' | 'day';
}

export interface AnalyticsScope {
  teamIds: number[];
  projectIds?: number[] | null;
}

// Whether the scope reads nothing at all, which no query is sent for.
function emptyScope(scope: AnalyticsScope): boolean {
  return scope.teamIds.length === 0 || scope.projectIds?.length === 0;
}

export async function workspaceScope(workspaceId: number): Promise<AnalyticsScope> {
  const rows = await db.select({ id: team.id }).from(team).where(eq(team.workspaceId, workspaceId));
  return { teamIds: rows.map((row) => row.id) };
}

// The prices the workspace of the scope set itself, which the dashboard costs calls
// with before the built-in table. The teams of one scope share a workspace.
export async function ownPrices(scope: AnalyticsScope): Promise<OwnPrices> {
  if (scope.teamIds.length === 0) return new Map();
  const rows = await db
    .selectDistinct({
      provider: modelPrice.provider,
      model: modelPrice.model,
      input: modelPrice.input,
      output: modelPrice.output,
      cacheRead: modelPrice.cacheRead,
      cacheWrite: modelPrice.cacheWrite,
    })
    .from(modelPrice)
    .innerJoin(team, eq(team.workspaceId, modelPrice.workspaceId))
    .where(inArray(team.id, scope.teamIds));
  return new Map(rows.map((row) => [priceKey(row.provider, row.model), row]));
}

// The scope narrowed to one project, when one is asked for. A project it does not read
// leaves it reading nothing.
export function onlyProject(scope: AnalyticsScope, projectId?: number): AnalyticsScope {
  if (projectId == null) return scope;
  const readable = !scope.projectIds || scope.projectIds.includes(projectId);
  return { ...scope, projectIds: readable ? [projectId] : [] };
}

// The projects the scope reads, by name: what it may be narrowed to.
export async function analyticsProjects(
  scope: AnalyticsScope,
): Promise<{ projectId: number; name: string }[]> {
  if (emptyScope(scope)) return [];
  return db
    .select({ projectId: project.id, name: project.name })
    .from(project)
    .where(
      and(
        inArray(project.teamId, scope.teamIds),
        scope.projectIds ? inArray(project.id, scope.projectIds) : undefined,
      ),
    )
    .orderBy(project.name);
}

export function analyticsWindow(days: number): AnalyticsWindow {
  const bucket = days <= 1 ? 'hour' : 'day';
  const to = new Date();
  const windowMs = days * 24 * 60 * 60 * 1000;
  const from = new Date(to.getTime() - windowMs);
  return { from, to, previousFrom: new Date(from.getTime() - windowMs), bucket };
}

// The runs of the scope since `from`, one row per trace, as a statement to put in a
// WITH clause. `metadata` is the whole of what the run carried, for a reader that
// groups by more of it; its `runId` is ours on a queued run and Mastra's own UUID on a
// chat run. A team id that is not a number is left out rather than cast, inside a CASE
// since Postgres does not evaluate the conditions of an AND in order. The bound is
// passed as text and cast in the statement: the driver binds no Date inside a composed
// fragment.
export function tracedRuns(scope: AnalyticsScope, from: Date): SQL {
  const ids = (list: number[]) =>
    sql.join(
      list.map((id) => sql`${id}`),
      sql`, `,
    );
  const teamId = sql`CASE WHEN r.metadata->>'teamId' ~ '^[0-9]+$'
                         THEN (r.metadata->>'teamId')::int END`;
  const projects = scope.projectIds
    ? sql` AND CASE WHEN r.metadata->>'projectId' ~ '^[0-9]+$'
                    THEN (r.metadata->>'projectId')::int END IN (${ids(scope.projectIds)})`
    : sql``;
  return sql`
    SELECT r."traceId" AS trace_id,
           ${teamId} AS team_id,
           (r.metadata->>'agentId')::int AS agent_id,
           (r.metadata->>'projectId')::int AS project_id,
           r."startedAtZ" AS started_at,
           r."endedAtZ" AS ended_at,
           (r.error IS NOT NULL) AS failed,
           r.metadata AS metadata
      FROM mastra_ai_spans r
     WHERE r."parentSpanId" IS NULL
       AND ${teamId} IN (${ids(scope.teamIds)})
       AND r."startedAtZ" >= ${from.toISOString()}::timestamptz${projects}
  `;
}

// The raw driver hands a timestamp back as text.
function dayOf(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

// One row per bucket, period, team, agent, project and model: the model calls the runs
// of that bucket made. Fine enough to fold into every panel, and coarse enough that a long
// window stays a few hundred rows. A project belongs to one team, so the team adds no
// rows of its own. The token sums are bigint, which the driver hands back as a string.
type CallRow = {
  day: unknown;
  in_window: boolean;
  team_id: number | null;
  agent_id: number | null;
  project_id: number | null;
  provider: string | null;
  model: string | null;
  calls: number;
  input_tokens: unknown;
  output_tokens: unknown;
  cache_read: unknown;
  cache_write: unknown;
};

async function modelCalls(scope: AnalyticsScope, window: AnalyticsWindow): Promise<CallRow[]> {
  const rows = await db.execute(sql`
    WITH runs AS (${tracedRuns(scope, window.previousFrom)})
    SELECT date_trunc(${window.bucket}::text, s."startedAtZ") AS day,
           s."startedAtZ" >= ${window.from.toISOString()}::timestamptz AS in_window,
           runs.team_id,
           runs.agent_id,
           runs.project_id,
           s.attributes->>'provider' AS provider,
           s.attributes->>'model' AS model,
           count(*)::int AS calls,
           coalesce(sum((s.attributes->'usage'->>'inputTokens')::bigint), 0) AS input_tokens,
           coalesce(sum((s.attributes->'usage'->>'outputTokens')::bigint), 0) AS output_tokens,
           coalesce(sum((s.attributes->'usage'->'inputDetails'->>'cacheRead')::bigint), 0)
             AS cache_read,
           coalesce(sum((s.attributes->'usage'->'inputDetails'->>'cacheWrite')::bigint), 0)
             AS cache_write
      FROM mastra_ai_spans s
      JOIN runs ON runs.trace_id = s."traceId"
     WHERE s."spanType" = 'model_inference'
     GROUP BY 1, 2, 3, 4, 5, 6, 7
  `);
  return rows as unknown as CallRow[];
}

// The models the runs of the scope called since `from`, with how many calls each: the
// models a workspace's price list starts from.
export async function modelsCalled(
  scope: AnalyticsScope,
  from: Date,
): Promise<{ provider: string; model: string; calls: number }[]> {
  if (emptyScope(scope) || !(await spansTableExists())) return [];
  const rows = await db.execute(sql`
    WITH runs AS (${tracedRuns(scope, from)})
    SELECT s.attributes->>'provider' AS provider,
           s.attributes->>'model' AS model,
           count(*)::int AS calls
      FROM mastra_ai_spans s
      JOIN runs ON runs.trace_id = s."traceId"
     WHERE s."spanType" = 'model_inference'
       AND s.attributes->>'provider' <> ''
       AND s.attributes->>'model' <> ''
     GROUP BY 1, 2
     ORDER BY calls DESC, 1, 2
  `);
  return rows as unknown as { provider: string; model: string; calls: number }[];
}

type RunRow = {
  in_window: boolean;
  team_id: number | null;
  agent_id: number | null;
  project_id: number | null;
  runs: number;
  errors: number;
};

async function runsPerPeriod(scope: AnalyticsScope, window: AnalyticsWindow): Promise<RunRow[]> {
  const rows = await db.execute(sql`
    WITH runs AS (${tracedRuns(scope, window.previousFrom)})
    SELECT started_at >= ${window.from.toISOString()}::timestamptz AS in_window,
           team_id,
           agent_id,
           project_id,
           count(*)::int AS runs,
           count(*) FILTER (WHERE failed)::int AS errors
      FROM runs
     GROUP BY 1, 2, 3, 4
  `);
  return rows as unknown as RunRow[];
}

function callUsage(row: CallRow): CallUsage {
  return {
    inputTokens: num(row.input_tokens),
    outputTokens: num(row.output_tokens),
    cacheReadTokens: num(row.cache_read),
    cacheWriteTokens: num(row.cache_write),
  };
}

function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cost: null };
}

function emptyTotals(): AgentAnalyticsTotals {
  return { runs: 0, errors: 0, ...emptyUsage() };
}

function addUsage(entry: Usage, usage: CallUsage, cost: number | null): void {
  entry.inputTokens += usage.inputTokens;
  entry.outputTokens += usage.outputTokens;
  if (cost != null) entry.cost = (entry.cost ?? 0) + cost;
}

function addRuns(entry: AgentAnalyticsTotals, row: RunRow): void {
  entry.runs += row.runs;
  entry.errors += row.errors;
}

function entryOf<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let entry = map.get(key);
  if (!entry) {
    entry = init();
    map.set(key, entry);
  }
  return entry;
}

const tokensOf = (entry: Usage) => entry.inputTokens + entry.outputTokens;
const byTokens = (a: Usage, b: Usage) => tokensOf(b) - tokensOf(a);

export async function getAgentAnalytics(
  scope: AnalyticsScope,
  days: number,
): Promise<AgentAnalytics> {
  const window = analyticsWindow(days);
  const totals = emptyTotals();
  const previous = emptyTotals();
  const result: AgentAnalytics = {
    from: iso(window.from),
    to: iso(window.to),
    totals,
    previous,
    models: [],
    agents: [],
    projects: [],
    teams: [],
    tokensPerDay: [],
  };
  if (emptyScope(scope) || !(await spansTableExists())) return result;

  const [calls, runs, agentRows, projectRows, teamRows, own] = await Promise.all([
    modelCalls(scope, window),
    runsPerPeriod(scope, window),
    db
      .select({ id: aiAgent.id, name: user.name })
      .from(aiAgent)
      .innerJoin(user, eq(user.id, aiAgent.userId))
      .where(inArray(aiAgent.teamId, scope.teamIds)),
    db
      .select({ id: project.id, name: project.name })
      .from(project)
      .where(inArray(project.teamId, scope.teamIds)),
    db.select({ id: team.id, name: team.name }).from(team).where(inArray(team.id, scope.teamIds)),
    ownPrices(scope),
  ]);

  const agentNames = new Map(agentRows.map((row) => [row.id, row.name]));
  const projectNames = new Map(projectRows.map((row) => [row.id, row.name]));
  const teamNames = new Map(teamRows.map((row) => [row.id, row.name]));
  const byModel = new Map<string, AgentAnalytics['models'][number]>();
  const byAgent = new Map<number, AgentAnalytics['agents'][number]>();
  const byProject = new Map<number, AgentAnalytics['projects'][number]>();
  const byTeam = new Map<number, AgentAnalytics['teams'][number]>();
  const byDay = new Map<string, AgentAnalytics['tokensPerDay'][number]>();
  // A deleted agent or project keeps its figures under an empty name.
  const agentEntry = (id: number) =>
    entryOf(byAgent, id, () => ({ agentId: id, name: agentNames.get(id) ?? '', ...emptyTotals() }));
  const projectEntry = (id: number) =>
    entryOf(byProject, id, () => ({
      projectId: id,
      name: projectNames.get(id) ?? '',
      ...emptyTotals(),
    }));
  const teamEntry = (id: number) =>
    entryOf(byTeam, id, () => ({ teamId: id, name: teamNames.get(id) ?? '', ...emptyTotals() }));

  for (const row of calls) {
    const usage = callUsage(row);
    const provider = row.provider ?? '';
    const model = row.model ?? '';
    const cost = provider && model ? estimateCost(provider, model, usage, row.calls, own) : null;
    if (!row.in_window) {
      addUsage(previous, usage, cost);
      continue;
    }
    addUsage(totals, usage, cost);
    const modelEntry = entryOf(byModel, `${provider}/${model}`, () => ({
      provider,
      model,
      calls: 0,
      ...emptyUsage(),
    }));
    modelEntry.calls += row.calls;
    addUsage(modelEntry, usage, cost);
    if (row.agent_id != null) addUsage(agentEntry(row.agent_id), usage, cost);
    if (row.project_id != null) addUsage(projectEntry(row.project_id), usage, cost);
    if (row.team_id != null) addUsage(teamEntry(row.team_id), usage, cost);
    const key = iso(dayOf(row.day));
    addUsage(
      entryOf(byDay, key, () => ({ day: key, ...emptyUsage() })),
      usage,
      cost,
    );
  }

  for (const row of runs) {
    if (!row.in_window) {
      addRuns(previous, row);
      continue;
    }
    addRuns(totals, row);
    if (row.agent_id != null) addRuns(agentEntry(row.agent_id), row);
    if (row.project_id != null) addRuns(projectEntry(row.project_id), row);
    if (row.team_id != null) addRuns(teamEntry(row.team_id), row);
  }

  result.models = [...byModel.values()].sort(byTokens);
  result.agents = [...byAgent.values()].sort(byTokens);
  result.projects = [...byProject.values()].sort(byTokens);
  result.teams = [...byTeam.values()].sort(byTokens);
  result.tokensPerDay = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  return result;
}
