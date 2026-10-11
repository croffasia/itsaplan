import { db } from '@repo/db';
import { sql } from 'drizzle-orm';
import { getStore } from './store';
import { toIso } from '../helpers/dates';
import type { AgentRunTrigger } from '../../model';

// Read side of the traces observability.ts writes: one trace per run of an internal
// agent, holding a span for the run and one for every model call and tool call inside
// it. The spans are Mastra's own rows and carry no foreign keys of ours, so a trace is
// found by the metadata the run put on it (see prepareRun in index.ts) — the store
// indexes that metadata, so filtering on it is a lookup, not a scan.

// The trace of one run, as the list shows it.
export interface TraceSummary {
  traceId: string;
  name: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  projectId: number | null;
  // The queued run this traced, and what triggered it. Null for a trace of the test
  // chat, which is queued nowhere.
  runId: number | null;
  trigger: AgentRunTrigger | null;
  issueId: number | null;
}

// One step of a trace: the run itself, a model call, or a tool call.
export interface TraceSpan {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  type: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  error: unknown;
  // What the span itself reports: the model and its token counts for a model call,
  // the arguments for a tool call.
  attributes: unknown;
}

async function traceStore() {
  // Mastra creates its tables on an agent's first run; init creates them on an instance
  // whose agents never ran, and returns at once after the first call.
  await getStore().init();
  const store = await getStore().getStore('observability');
  if (!store) throw new Error('The agent store keeps no traces');
  return store;
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function timeOf(value: Date | string): number {
  return new Date(toIso(value)).getTime();
}

function durationOf(startedAt: Date | string, endedAt: Date | string | null | undefined) {
  return endedAt == null ? null : timeOf(endedAt) - timeOf(startedAt);
}

type SpanRow = {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  spanType: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  error?: unknown;
  metadata?: Record<string, unknown> | null;
};

// A span holds no status of its own: it is derived from its error and its end.
function statusOf(span: SpanRow): string {
  if (span.error != null) return 'error';
  return span.endedAt ? 'success' : 'running';
}

function toSummary(span: SpanRow): TraceSummary {
  const metadata = span.metadata ?? {};
  const trigger = metadata.trigger;
  return {
    traceId: span.traceId,
    name: span.name,
    status: statusOf(span),
    startedAt: toIso(span.startedAt),
    endedAt: span.endedAt ? toIso(span.endedAt) : null,
    durationMs: durationOf(span.startedAt, span.endedAt),
    projectId: numberOf(metadata.projectId),
    runId: numberOf(metadata.runId),
    trigger: typeof trigger === 'string' ? (trigger as AgentRunTrigger) : null,
    issueId: numberOf(metadata.issueId),
  };
}

// One page of the agent's traces the viewer may read, newest first, optionally only
// those of one project. A chat run carries the member who chatted, and its spans hold
// what they wrote, so like the chat thread itself its trace is theirs alone: the team's
// owner reads it no more than anyone else. Read with SQL rather than the store's list,
// whose metadata filter matches values and cannot leave out the chats of other people.
export async function listAgentTraces(
  agentId: number,
  viewerId: string,
  opts: { projectId?: number; limit: number; offset: number },
): Promise<{ items: TraceSummary[]; total: number }> {
  await traceStore();
  const where = sql`r."parentSpanId" IS NULL
    AND r.metadata->>'agentId' = ${String(agentId)}
    AND (r.metadata->>'userId' IS NULL OR r.metadata->>'userId' = ${viewerId})
    ${opts.projectId != null ? sql`AND r.metadata->>'projectId' = ${String(opts.projectId)}` : sql``}`;
  const [rows, counted] = await Promise.all([
    db.execute(sql`
      SELECT r."traceId", r."spanId", r.name, r."spanType", r.error, r.metadata,
             r."startedAtZ" AS "startedAt", r."endedAtZ" AS "endedAt"
        FROM mastra_ai_spans r
       WHERE ${where}
       ORDER BY r."startedAtZ" DESC
       LIMIT ${opts.limit} OFFSET ${opts.offset}`),
    db.execute(sql`SELECT count(*)::int AS total FROM mastra_ai_spans r WHERE ${where}`),
  ]);
  const [count] = counted as unknown as { total: number }[];
  return { items: (rows as unknown as SpanRow[]).map(toSummary), total: count?.total ?? 0 };
}

// Every span of one trace, oldest first, or null when the trace is not this agent's or
// is another person's chat — either reads as missing rather than as refused.
export async function getAgentTrace(
  agentId: number,
  traceId: string,
  viewerId: string,
): Promise<{ trace: TraceSummary; spans: TraceSpan[] } | null> {
  const store = await traceStore();
  const trace = await store.getTrace({ traceId });
  if (!trace) return null;
  const root = trace.spans.find((span) => span.parentSpanId == null);
  if (!root || numberOf(root.metadata?.agentId) !== agentId) return null;
  const chattedBy = root.metadata?.userId;
  if (chattedBy != null && chattedBy !== viewerId) return null;
  const spans = [...trace.spans]
    .sort((a, b) => timeOf(a.startedAt) - timeOf(b.startedAt))
    .map((span) => ({
      spanId: span.spanId,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      type: span.spanType,
      status: statusOf(span),
      startedAt: toIso(span.startedAt),
      endedAt: span.endedAt ? toIso(span.endedAt) : null,
      durationMs: durationOf(span.startedAt, span.endedAt),
      input: span.input ?? null,
      output: span.output ?? null,
      error: span.error ?? null,
      attributes: span.attributes ?? null,
    }));
  return { trace: toSummary(root), spans };
}
