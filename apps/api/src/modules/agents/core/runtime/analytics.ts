import { db, aiAgent } from '@repo/db';
import { eq, sql, type SQL } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { spansTableExists } from './store';
import { estimateCost } from './model-pricing';

// The figures behind the agent dashboard, read from the traces the runtime records
// (see observability.ts). One trace is one run: its root span carries the team, the
// agent and the project in metadata, and its children are the model calls and the tool
// calls the run made. The spans hold no foreign keys of ours, so everything is scoped
// through that metadata and the agent names are read separately.
//
// The window is asked for in days and always read twice: the period itself and the one
// before it, so every headline figure carries what it moved from. Both come back in a
// single pass over the spans, split by the bucket each row falls in: an hour for a
// window of a day, a day for anything longer.
//
// Traces are deleted once past their team's retention window, so a window longer than
// the retention shows only what is still stored.

// The token counts a model call reports. `inputTokens` is the whole input, the cached
// tokens included; the cache counts are what the price table bills separately.
interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

// A headline figure of the period, beside what the period before it held.
export interface AgentAnalyticsTotals {
  runs: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  // Null when no call of the period could be priced — the price table names no such
  // provider and model. A partial period reports what it could price.
  cost: number | null;
}

export interface AgentAnalytics {
  from: string;
  to: string;
  totals: AgentAnalyticsTotals;
  previous: AgentAnalyticsTotals;
  // Conversation threads the agents hold now. Not a figure of the window: a thread
  // lives until its agent, project or issue is deleted.
  threads: number;
  models: {
    provider: string;
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cost: number | null;
  }[];
  agents: {
    agentId: number;
    name: string;
    runs: number;
    errors: number;
    inputTokens: number;
    outputTokens: number;
    cost: number | null;
  }[];
  tokensPerDay: { day: string; inputTokens: number; outputTokens: number; cost: number | null }[];
  tools: { name: string; calls: number; errors: number }[];
  latencyPerDay: { day: string; p50: number; p95: number }[];
}

// What the rows are grouped by. A window of a day is grouped by the hour: a day bucket
// crosses the start of the window, so most of the last 24 hours would be counted
// against the period before it.
type Bucket = 'hour' | 'day';

export interface AgentAnalyticsScope {
  teamId: number;
  // Set for the project dashboard; the team dashboard reads every project of the team.
  projectId?: number;
  days: number;
}

const EMPTY_TOTALS: AgentAnalyticsTotals = {
  runs: 0,
  errors: 0,
  inputTokens: 0,
  outputTokens: 0,
  toolCalls: 0,
  cost: null,
};

// The traces of the scope over both periods, as a CTE the queries below join to. A
// metadata value is jsonb like any other, so a team id that is not a number is left
// out rather than cast. The window bound is passed as text and cast in the statement:
// the driver binds no Date inside a composed fragment.
function roots(scope: AgentAnalyticsScope, from: Date): SQL {
  const project =
    scope.projectId == null
      ? sql``
      : sql` AND r.metadata->>'projectId' = ${String(scope.projectId)}`;
  return sql`
    SELECT r."traceId" AS trace_id,
           (r.metadata->>'agentId')::int AS agent_id,
           r."startedAtZ" AS started_at,
           r."endedAt" AS ended_at,
           (r.error IS NOT NULL) AS failed
      FROM mastra_ai_spans r
     WHERE r."parentSpanId" IS NULL
       AND r.metadata->>'teamId' ~ '^[0-9]+$'
       AND (r.metadata->>'teamId')::int = ${scope.teamId}
       AND r."startedAtZ" >= ${from.toISOString()}::timestamptz${project}
  `;
}

// Postgres counts as bigint, which arrives as a string; the token sums are read
// through this so a total is a number wherever it is used.
function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

// The bucket a grouped row falls in. The raw driver hands a timestamp back as text.
function dayOf(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function usageOf(row: {
  input_tokens: unknown;
  output_tokens: unknown;
  cache_read: unknown;
  cache_write: unknown;
}): Usage {
  return {
    inputTokens: num(row.input_tokens),
    outputTokens: num(row.output_tokens),
    cacheReadTokens: num(row.cache_read),
    cacheWriteTokens: num(row.cache_write),
  };
}

// Adds a priced amount to a running total that is null until something is priced.
function addCost(total: number | null, cost: number | null): number | null {
  if (cost == null) return total;
  return (total ?? 0) + cost;
}

// One row per bucket, agent and model: the model calls the runs of that bucket made.
// The grouping is fine enough to fold into every panel that counts tokens, and coarse
// enough that a long window stays a few hundred rows.
type CallRow = {
  day: unknown;
  agent_id: number | null;
  provider: string | null;
  model: string | null;
  calls: number;
  input_tokens: unknown;
  output_tokens: unknown;
  cache_read: unknown;
  cache_write: unknown;
};

async function modelCalls(
  scope: AgentAnalyticsScope,
  from: Date,
  bucket: Bucket,
): Promise<CallRow[]> {
  const rows = await db.execute(sql`
    WITH roots AS (${roots(scope, from)})
    SELECT date_trunc(${bucket}::text, s."startedAtZ") AS day,
           roots.agent_id,
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
      JOIN roots ON roots.trace_id = s."traceId"
     WHERE s."spanType" = 'model_generation'
     GROUP BY 1, 2, 3, 4
  `);
  return rows as unknown as CallRow[];
}

type RunRow = { day: unknown; agent_id: number | null; runs: number; errors: number };

async function runsPerBucket(
  scope: AgentAnalyticsScope,
  from: Date,
  bucket: Bucket,
): Promise<RunRow[]> {
  const rows = await db.execute(sql`
    WITH roots AS (${roots(scope, from)})
    SELECT date_trunc(${bucket}::text, started_at) AS day,
           agent_id,
           count(*)::int AS runs,
           count(*) FILTER (WHERE failed)::int AS errors
      FROM roots
     GROUP BY 1, 2
  `);
  return rows as unknown as RunRow[];
}

// A tool call is a span of one of the three tool types Mastra emits (its own, an MCP
// tool, a provider tool); the span name is the tool.
type ToolRow = { day: unknown; name: string; calls: number; errors: number };

async function toolCalls(
  scope: AgentAnalyticsScope,
  from: Date,
  bucket: Bucket,
): Promise<ToolRow[]> {
  const rows = await db.execute(sql`
    WITH roots AS (${roots(scope, from)})
    SELECT date_trunc(${bucket}::text, s."startedAtZ") AS day,
           s.name AS name,
           count(*)::int AS calls,
           count(*) FILTER (WHERE s.error IS NOT NULL)::int AS errors
      FROM mastra_ai_spans s
      JOIN roots ON roots.trace_id = s."traceId"
     WHERE s."spanType" LIKE '%tool_call'
     GROUP BY 1, 2
  `);
  return rows as unknown as ToolRow[];
}

// How long a run took, as the median and the 95th percentile of the bucket. A run
// still going has no duration yet and is left out.
type LatencyRow = { day: unknown; p50: number; p95: number };

async function latencyPerBucket(
  scope: AgentAnalyticsScope,
  from: Date,
  bucket: Bucket,
): Promise<LatencyRow[]> {
  const ms = sql`extract(epoch from (ended_at - started_at)) * 1000`;
  const rows = await db.execute(sql`
    WITH roots AS (${roots(scope, from)})
    SELECT date_trunc(${bucket}::text, started_at) AS day,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ms})::int AS p50,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY ${ms})::int AS p95
      FROM roots
     WHERE ended_at IS NOT NULL
     GROUP BY 1
  `);
  return rows as unknown as LatencyRow[];
}

// The conversation threads the scope's agents hold. Mastra's threads carry the agent
// and the project in their own metadata, the same way the traces do.
async function threadCount(scope: AgentAnalyticsScope, agentIds: number[]): Promise<number> {
  if (agentIds.length === 0) return 0;
  const bound =
    scope.projectId == null
      ? sql`t.metadata->>'agentId' IN (${sql.join(
          agentIds.map((id) => sql`${String(id)}`),
          sql`, `,
        )})`
      : sql`t.metadata->>'projectId' = ${String(scope.projectId)}`;
  const rows = await db.execute(sql`
    SELECT count(*)::int AS count FROM mastra_threads t WHERE ${bound}
  `);
  return (rows as unknown as { count: number }[])[0]?.count ?? 0;
}

function emptyAnalytics(from: Date, to: Date): AgentAnalytics {
  return {
    from: iso(from),
    to: iso(to),
    totals: { ...EMPTY_TOTALS },
    previous: { ...EMPTY_TOTALS },
    threads: 0,
    models: [],
    agents: [],
    tokensPerDay: [],
    tools: [],
    latencyPerDay: [],
  };
}

export async function getAgentAnalytics(scope: AgentAnalyticsScope): Promise<AgentAnalytics> {
  const bucket: Bucket = scope.days <= 1 ? 'hour' : 'day';
  const to = new Date();
  const windowMs = scope.days * 24 * 60 * 60 * 1000;
  const from = new Date(to.getTime() - windowMs);
  // The window starts where its first bucket does, so no bucket is split across the
  // boundary the two periods are told apart by.
  if (bucket === 'hour') from.setMinutes(0, 0, 0);
  const previousFrom = new Date(from.getTime() - windowMs);
  if (!(await spansTableExists())) return emptyAnalytics(from, to);

  const [calls, runs, tools, latency, agentRows] = await Promise.all([
    modelCalls(scope, previousFrom, bucket),
    runsPerBucket(scope, previousFrom, bucket),
    toolCalls(scope, previousFrom, bucket),
    latencyPerBucket(scope, from, bucket),
    db
      .select({ id: aiAgent.id, name: aiAgent.username })
      .from(aiAgent)
      .where(eq(aiAgent.teamId, scope.teamId)),
  ]);

  const totals = { ...EMPTY_TOTALS };
  const previous = { ...EMPTY_TOTALS };
  const current = (day: Date) => day.getTime() >= from.getTime();

  const byModel = new Map<string, AgentAnalytics['models'][number]>();
  const byAgent = new Map<number, AgentAnalytics['agents'][number]>();
  const byDay = new Map<string, AgentAnalytics['tokensPerDay'][number]>();
  const agentNames = new Map(agentRows.map((row) => [row.id, row.name]));

  for (const row of calls) {
    const day = dayOf(row.day);
    const usage = usageOf(row);
    const provider = row.provider ?? '';
    const model = row.model ?? '';
    const cost = provider && model ? estimateCost(provider, model, usage) : null;
    const bucket = current(day) ? totals : previous;
    bucket.inputTokens += usage.inputTokens;
    bucket.outputTokens += usage.outputTokens;
    bucket.cost = addCost(bucket.cost, cost);
    if (!current(day)) continue;

    const modelKey = `${provider}/${model}`;
    const modelEntry = byModel.get(modelKey) ?? {
      provider,
      model,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: null,
    };
    modelEntry.calls += row.calls;
    modelEntry.inputTokens += usage.inputTokens;
    modelEntry.outputTokens += usage.outputTokens;
    modelEntry.cost = addCost(modelEntry.cost, cost);
    byModel.set(modelKey, modelEntry);

    if (row.agent_id != null) {
      const agentEntry = byAgent.get(row.agent_id) ?? {
        agentId: row.agent_id,
        name: agentNames.get(row.agent_id) ?? '',
        runs: 0,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: null,
      };
      agentEntry.inputTokens += usage.inputTokens;
      agentEntry.outputTokens += usage.outputTokens;
      agentEntry.cost = addCost(agentEntry.cost, cost);
      byAgent.set(row.agent_id, agentEntry);
    }

    const key = iso(day);
    const dayEntry = byDay.get(key) ?? { day: key, inputTokens: 0, outputTokens: 0, cost: null };
    dayEntry.inputTokens += usage.inputTokens;
    dayEntry.outputTokens += usage.outputTokens;
    dayEntry.cost = addCost(dayEntry.cost, cost);
    byDay.set(key, dayEntry);
  }

  for (const row of runs) {
    const day = dayOf(row.day);
    const bucket = current(day) ? totals : previous;
    bucket.runs += row.runs;
    bucket.errors += row.errors;
    if (!current(day) || row.agent_id == null) continue;
    const entry = byAgent.get(row.agent_id) ?? {
      agentId: row.agent_id,
      name: agentNames.get(row.agent_id) ?? '',
      runs: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: null,
    };
    entry.runs += row.runs;
    entry.errors += row.errors;
    byAgent.set(row.agent_id, entry);
  }

  const byTool = new Map<string, AgentAnalytics['tools'][number]>();
  for (const row of tools) {
    const day = dayOf(row.day);
    (current(day) ? totals : previous).toolCalls += row.calls;
    if (!current(day)) continue;
    const entry = byTool.get(row.name) ?? { name: row.name, calls: 0, errors: 0 };
    entry.calls += row.calls;
    entry.errors += row.errors;
    byTool.set(row.name, entry);
  }

  const tokensOf = (entry: { inputTokens: number; outputTokens: number }) =>
    entry.inputTokens + entry.outputTokens;

  return {
    from: iso(from),
    to: iso(to),
    totals,
    previous,
    threads: await threadCount(
      scope,
      agentRows.map((row) => row.id),
    ),
    models: [...byModel.values()].sort((a, b) => tokensOf(b) - tokensOf(a)),
    agents: [...byAgent.values()].sort((a, b) => tokensOf(b) - tokensOf(a)),
    tokensPerDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    tools: [...byTool.values()].sort((a, b) => b.calls - a.calls),
    latencyPerDay: latency
      .map((row) => ({ day: iso(dayOf(row.day)), p50: num(row.p50), p95: num(row.p95) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}
