import type { AiChatPart, AiChatToolPart } from '@/lib/api/endpoints/agentChat';
import type { ExternalRunTrace } from '@/lib/api/endpoints/agents';

// One step of a run. A model part is one call to the model, which only an internal
// agent's trace records. `durationMs` is absent when the trace does not say when the step
// ended; `running` marks a step the trace records as still going.
export type TracePart = (AiChatPart | { type: 'model' }) & {
  receivedAt: string;
  durationMs?: number;
  error?: string;
  running?: boolean;
};

type ToolStep = AiChatToolPart & { receivedAt: string; durationMs?: number };

export function externalTraceParts(events: ExternalRunTrace['events']) {
  const parts: TracePart[] = [];
  const tools = new Map<string, ToolStep>();
  for (const { event, receivedAt } of events) {
    if (event.type === 'TOOL_CALL_START' && event.toolCallId) {
      const tool: ToolStep = {
        type: 'tool',
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
      if (tool) {
        tool.result = event.content ?? '';
        tool.durationMs = Date.parse(receivedAt) - Date.parse(tool.receivedAt);
      }
    } else if (event.type === 'TEXT_MESSAGE_CONTENT') {
      const text = event.delta ?? '';
      const previous = parts.at(-1);
      if (previous?.type === 'text' && !previous.error) previous.text += text;
      else parts.push({ type: 'text', text, receivedAt });
    } else if (event.type === 'RUN_ERROR') {
      const message = event.message || 'RUN_ERROR';
      parts.push({ type: 'text', text: message, receivedAt, error: message });
    }
  }
  return parts;
}
