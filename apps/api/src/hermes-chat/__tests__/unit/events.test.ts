import { describe, expect, it } from 'bun:test';
import { mapHermesEvent } from '../../events';

describe('Hermes SSE event mapping', () => {
  it('maps text and tool lifecycle events to the dashboard contract', () => {
    expect(mapHermesEvent('assistant.delta', { delta: 'Hello' }, 'request-1', 1)).toEqual({
      type: 'text',
      value: 'Hello',
    });
    expect(
      mapHermesEvent(
        'tool.started',
        { tool_name: 'web_search', args: { apiKey: 'secret' } },
        'request-1',
        2,
      ),
    ).toEqual({ type: 'tool-start', toolCallId: 'request-1:2', toolName: 'web_search' });
    expect(
      mapHermesEvent(
        'tool.completed',
        { tool_name: 'web_search', preview: 'private output' },
        'request-1',
        3,
      ),
    ).toEqual({ type: 'tool-end', toolCallId: 'request-1:3', toolName: 'web_search' });
  });

  it('does not forward raw upstream errors, tool arguments, or unknown events', () => {
    expect(
      mapHermesEvent('error', { message: 'key=super-secret C:\\Users\\x' }, 'request-1', 1),
    ).toEqual({
      type: 'error',
      message: 'Bob could not complete this response.',
    });
    expect(mapHermesEvent('debug.config', { api_key: 'secret' }, 'request-1', 2)).toBeNull();
  });
});
