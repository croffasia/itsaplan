import assert from 'node:assert/strict';
import { it } from 'node:test';
import { externalTraceParts } from './externalTraceParts';

it('keeps messages in order and joins each tool input and result by its id', () => {
  const receivedAt = '2026-01-01T00:00:00Z';
  const events = [
    { type: 'TEXT_MESSAGE_CONTENT', delta: 'Looking ' },
    { type: 'TEXT_MESSAGE_CONTENT', delta: 'up' },
    { type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'get_issue' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"id":' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '1}' },
    { type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: 'Found' },
    { type: 'TEXT_MESSAGE_CONTENT', delta: 'Done' },
  ].map((event) => ({ event, receivedAt }));
  assert.deepEqual(externalTraceParts(events), [
    { type: 'text', text: 'Looking up', receivedAt },
    {
      type: 'tool',
      toolCallId: 't1',
      toolName: 'get_issue',
      args: '{"id":1}',
      result: 'Found',
      receivedAt,
    },
    { type: 'text', text: 'Done', receivedAt },
  ]);
});
