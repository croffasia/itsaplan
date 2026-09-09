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
  const store = await getStore().getStore('observability');
  if (!store) throw new Error('The agent store keeps no traces');
  return store;
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function durationOf(startedAt: Date | string, endedAt: Date | string | null | undefined) {
  if (endedAt == null) return null;
  return new Date(toIso(endedAt)).getTime() - new Date(toIso(startedAt)).getTime();
}

type SpanRow = {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  spanType: string;
  status?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  error?: unknown;
  metadata?: Record<string, unknown> | null;
};

// The list computes the status of a trace; the spans of one trace carry what they
// ended with instead, so it is read the same way here.
function statusOf(span: SpanRow): string {
  if (span.status) return span.status;
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

// One page of the agent's traces, newest first, optionally only those of one project.
// The window is the offset pair every paged list takes; the store pages by number, and
// an offset is always a whole number of pages of its own size.
export async function listAgentTraces(
  agentId: number,
  opts: { projectId?: number; limit: number; offset: number },
): Promise<{ items: TraceSummary[]; total: number }> {
  const store = await traceStore();
  const { spans, pagination } = await store.listTracesLight({
    filters: {
      metadata: {
        agentId,
        ...(opts.projectId != null ? { projectId: opts.projectId } : {}),
      },
    },
    pagination: { page: opts.offset / opts.limit, perPage: opts.limit },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  return { items: spans.map(toSummary), total: pagination?.total ?? spans.length };
}

// Every span of one trace, oldest first, or null when the trace is not this agent's —
// a trace of another agent reads as missing rather than as refused.
export async function getAgentTrace(
  agentId: number,
  traceId: string,
): Promise<{ trace: TraceSummary; spans: TraceSpan[] } | null> {
  const store = await traceStore();
  const trace = await store.getTrace({ traceId });
  if (!trace) return null;
  const root = trace.spans.find((span) => span.parentSpanId == null);
  if (!root || numberOf(root.metadata?.agentId) !== agentId) return null;
  const spans = [...trace.spans]
    .sort((a, b) => new Date(toIso(a.startedAt)).getTime() - new Date(toIso(b.startedAt)).getTime())
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
