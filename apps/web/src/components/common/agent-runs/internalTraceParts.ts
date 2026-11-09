import type { IssueAgentTraceSpan } from '@/lib/api/endpoints/issues';
import type { TracePart } from './externalTraceParts';

// An internal agent's trace in the shape of an external run's transcript: each tool call
// with its arguments and result, then the answer. The model's own spans are left out.
export function internalTraceParts(spans: IssueAgentTraceSpan[]): TracePart[] {
  const parts: TracePart[] = spans
    .filter((span) => span.type === 'tool_call' || span.type === 'mcp_tool_call')
    .map((span) => ({
      type: 'tool',
      toolCallId: span.spanId,
      toolName: toolNameOf(span.name),
      args: textOf(span.input),
      result: textOf(span.output),
      receivedAt: span.startedAt,
    }));
  const run = spans.find((span) => span.parentSpanId == null);
  const answer = run && answerOf(run.output);
  if (answer) parts.push({ type: 'text', text: answer, receivedAt: run.endedAt ?? run.startedAt });
  return parts;
}

// Mastra names a tool span `tool: '<name>'`, and an MCP one `mcp_tool: '<name>' on '<server>'`.
function toolNameOf(spanName: string): string {
  return /^(?:mcp_)?tool: '([^']*)'/.exec(spanName)?.[1] ?? spanName;
}

function textOf(value: unknown): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// The agent's span ends with `{ text, object, files }`.
function answerOf(output: unknown): string | undefined {
  if (typeof output === 'string') return output;
  const text = (output as { text?: unknown } | null)?.text;
  return typeof text === 'string' && text !== '' ? text : undefined;
}
