import type { AiChatPart, AiChatToolPart } from '@/lib/api/endpoints/agentChat';
import type { ExternalRunTrace } from '@/lib/api/endpoints/agents';

export function externalTraceParts(events: ExternalRunTrace['events']) {
  const parts: (AiChatPart & { receivedAt: string })[] = [];
  const tools = new Map<string, AiChatToolPart>();
  for (const { event, receivedAt } of events) {
    if (event.type === 'TOOL_CALL_START' && event.toolCallId) {
      const tool = {
        type: 'tool' as const,
        toolCallId: event.toolCallId,
        toolName: event.toolCallName ?? '',
        args: '',
        receivedAt,
      };
      tools.set(event.toolCallId, tool);
      parts.push(tool);
    } else if (event.type === 'TOOL_CALL_ARGS') {
      const tool = tools.get(event.toolCallId ?? '');
      if (tool) tool.args = (tool.args ?? '') + (event.delta ?? '');
    } else if (event.type === 'TOOL_CALL_RESULT') {
      const tool = tools.get(event.toolCallId ?? '');
      if (tool) tool.result = event.content ?? '';
    } else if (event.type === 'TEXT_MESSAGE_CONTENT' || event.type === 'RUN_ERROR') {
      const text = event.delta ?? event.message ?? '';
      const previous = parts[parts.length - 1];
      if (previous?.type === 'text') previous.text += text;
      else parts.push({ type: 'text', text, receivedAt });
    }
  }
  return parts;
}
