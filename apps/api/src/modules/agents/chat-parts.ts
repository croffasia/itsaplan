import type { ChatPart } from './model';

// Building the parts of one chat message, shared by both kinds of agent: an internal
// agent's are read from the runtime's memory, an external agent's from the events its
// runner reported.

// How much of a call's arguments or result is kept. Cutting one breaks the JSON the chat
// indents and highlights, so the cap only catches an outsized call. The runner caps what
// it reports at the same size.
const TOOL_TEXT_LIMIT = 32_000;

// The arguments of a Mastra tool call as the chat shows them, without the runtime's own
// metadata, which the agent never wrote and the chat has nothing to do with.
export function toolArgsText(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return toolText(args);
  const rest = { ...(args as Record<string, unknown>) };
  delete rest.__mastraMetadata;
  return Object.keys(rest).length > 0 ? toolText(rest) : undefined;
}

// A call's arguments or result as the chat shows them: a string as it is, anything
// else as JSON, and nothing at all when the agent reported none.
export function toolText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return undefined;
  return text.length <= TOOL_TEXT_LIMIT ? text : `${text.slice(0, TOOL_TEXT_LIMIT)}…`;
}

// Adds text to the parts built so far, extending the last one when it is text: the
// stream arrives in chunks, and only a tool call between them starts a new part.
export function appendTextPart(parts: ChatPart[], text: string): void {
  if (!text) return;
  const last = parts[parts.length - 1];
  if (last?.type === 'text') last.text += text;
  else parts.push({ type: 'text', text });
}
