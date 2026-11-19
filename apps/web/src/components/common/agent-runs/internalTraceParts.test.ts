import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { IssueAgentTraceSpan } from '@/lib/api/endpoints/issues';
import { internalTraceParts } from './internalTraceParts';

function span(fields: Partial<IssueAgentTraceSpan>): IssueAgentTraceSpan {
  return {
    spanId: 's',
    parentSpanId: 'root',
    name: '',
    type: 'model_step',
    status: 'success',
    startedAt: '2026-01-01T00:00:00Z',
    endedAt: null,
    durationMs: null,
    input: null,
    output: null,
    error: null,
    attributes: null,
    ...fields,
  };
}

it('lists the model and tool calls in order, then the answer, and leaves out the spans around them', () => {
  const parts = internalTraceParts([
    span({
      spanId: 'root',
      parentSpanId: null,
      name: "agent run: 'bot'",
      type: 'agent_run',
      endedAt: '2026-01-01T00:00:09Z',
      output: { text: 'Done', object: null },
    }),
    span({ spanId: 'llm', name: "llm: 'gpt'", type: 'model_generation', output: { text: 'x' } }),
    span({
      spanId: 'call',
      name: "llm: 'gpt'",
      type: 'model_inference',
      startedAt: '2026-01-01T00:00:01Z',
      durationMs: 900,
    }),
    span({
      spanId: 't1',
      name: "tool: 'get_issue'",
      type: 'tool_call',
      startedAt: '2026-01-01T00:00:02Z',
      input: { issueId: 10 },
      output: { title: 'Photo' },
    }),
    span({
      spanId: 't2',
      name: "mcp_tool: 'search' on 'docs'",
      type: 'mcp_tool_call',
      startedAt: '2026-01-01T00:00:05Z',
      durationMs: 3000,
      input: 'query',
      error: { message: 'Timed out', id: 'TOOL_TIMEOUT' },
    }),
  ]);

  assert.deepEqual(parts, [
    { type: 'model', receivedAt: '2026-01-01T00:00:01Z', durationMs: 900 },
    {
      type: 'tool',
      toolCallId: 't1',
      toolName: 'get_issue',
      args: '{"issueId":10}',
      result: '{"title":"Photo"}',
      receivedAt: '2026-01-01T00:00:02Z',
    },
    {
      type: 'tool',
      toolCallId: 't2',
      toolName: 'search',
      args: 'query',
      result: undefined,
      receivedAt: '2026-01-01T00:00:05Z',
      durationMs: 3000,
      error: 'Timed out',
    },
    { type: 'text', text: 'Done', receivedAt: '2026-01-01T00:00:09Z' },
  ]);
});

it('adds no answer when the run wrote none', () => {
  const root = span({
    spanId: 'root',
    parentSpanId: null,
    type: 'agent_run',
    output: { text: '' },
  });
  assert.deepEqual(internalTraceParts([root]), []);
});
