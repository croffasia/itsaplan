import type { IssueAgentTraceSpan } from '@/lib/api/endpoints/issues';
import type { TracePart } from './externalTraceParts';

// An internal agent's trace in the shape of an external run's transcript: each model call
// and each tool call with its arguments and result, in the order they started, then the
// answer. A `model_inference` span is the provider call alone; the `model_generation` and
// `model_step` spans around it also cover the tool calls, so they are left out.
export function internalTraceParts(spans: IssueAgentTraceSpan[]): TracePart[] {
  const parts: TracePart[] = [];
  for (const span of spans) {
    if (span.type === 'model_inference') {
      parts.push({ type: 'model', ...stepOf(span) });
    } else if (span.type === 'tool_call' || span.type === 'mcp_tool_call') {
      parts.push({
        type: 'tool',
        toolCallId: span.spanId,
        toolName: toolNameOf(span.name),
        args: textOf(span.input),
        result: textOf(span.output),
        ...stepOf(span),
      });
    }
  }
  const run = spans.find((span) => span.parentSpanId == null);
  const answer = run && answerOf(run.output);
  if (answer) parts.push({ type: 'text', text: answer, receivedAt: run.endedAt ?? run.startedAt });
  return parts;
}

function stepOf(
  span: IssueAgentTraceSpan,
): Pick<TracePart, 'receivedAt' | 'durationMs' | 'error' | 'running'> {
  const error = errorOf(span.error);
  return {
    receivedAt: span.startedAt,
    ...(span.durationMs != null && { durationMs: span.durationMs }),
    ...(error && { error }),
    ...(span.status === 'running' && { running: true }),
  };
}

// Mastra names a tool span `tool: '<name>'`, and an MCP one `mcp_tool: '<name>' on '<server>'`.
function toolNameOf(spanName: string): string {
  return /^(?:mcp_)?tool: '([^']*)'/.exec(spanName)?.[1] ?? spanName;
}

function textOf(value: unknown): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// Mastra records a failed span's error as `{ message, … }`.
function errorOf(value: unknown): string | undefined {
  const message = (value as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : textOf(value);
}

// The agent's span ends with `{ text, object, files }`.
function answerOf(output: unknown): string | undefined {
  if (typeof output === 'string') return output;
  const text = (output as { text?: unknown } | null)?.text;
  return typeof text === 'string' && text !== '' ? text : undefined;
}
