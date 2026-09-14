export type DashboardChatEvent =
  | { type: 'text'; value: string }
  | { type: 'tool-start'; toolCallId: string; toolName: string }
  | { type: 'tool-end'; toolCallId: string; toolName: string }
  | { type: 'error'; message: string };

function safeToolName(value: unknown): string {
  if (typeof value !== 'string') return 'tool';
  return value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || 'tool';
}

export function mapHermesEvent(
  event: string,
  payload: unknown,
  requestId: string,
  sequence: number,
): DashboardChatEvent | null {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  if (event === 'assistant.delta' && typeof data.delta === 'string') {
    return { type: 'text', value: data.delta };
  }
  if (event === 'tool.started') {
    return {
      type: 'tool-start',
      toolCallId: `${requestId}:${sequence}`,
      toolName: safeToolName(data.tool_name),
    };
  }
  if (event === 'tool.completed' || event === 'tool.failed') {
    return {
      type: 'tool-end',
      toolCallId: `${requestId}:${sequence}`,
      toolName: safeToolName(data.tool_name),
    };
  }
  if (event === 'error') {
    return { type: 'error', message: 'Bob could not complete this response.' };
  }
  return null;
}
