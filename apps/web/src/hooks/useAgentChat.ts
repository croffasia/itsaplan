'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, streamAiAgentChat, streamAiAgentRun } from '@/lib/api';
import type { AiChatMessage, AiChatPart, AiChatToolPart } from '@/lib/api';
import { useTranslations } from 'next-intl';

export type ChatMessage = AiChatMessage;

// Only a tool call between two chunks of the answer starts a new text part.
function appendText(parts: AiChatPart[], chunk: string): AiChatPart[] {
  const last = parts[parts.length - 1];
  if (last?.type !== 'text') return [...parts, { type: 'text', text: chunk }];
  return [...parts.slice(0, -1), { type: 'text', text: last.text + chunk }];
}

// What a call was given or answered arrives after the call itself.
function updateToolPart(
  parts: AiChatPart[],
  toolCallId: string,
  update: (part: AiChatToolPart) => AiChatToolPart,
): AiChatPart[] {
  return parts.map((part) =>
    part.type === 'tool' && part.toolCallId === toolCallId ? update(part) : part,
  );
}

// 'queued' is the wait an external agent's message goes through: it is on the feed and
// no runner has taken it yet, so nothing is being written.
export type ChatStatus = 'ready' | 'queued' | 'streaming';

// Drives one conversation with an agent. Sends a prompt, streams the response over
// SSE, and exposes the running transcript, the stream status, and the tool the agent
// is currently using (for the status marker).
//
// An internal agent answers in the API process (streamAiAgentRun); an external one is
// answered by its runner on the operator's machine (streamAiAgentChat), which is why
// its answer starts only once that runner picks the message up. Both produce the same
// events, so everything below is the same for either.
//
// When the agent has memory enabled, the run belongs to a conversation thread: the
// thread id returned by the first message is kept so follow-up messages continue it,
// and it is surfaced as `threadId` so the host can reflect the new thread in the
// history list. loadThread() restores a past conversation; newChat() starts a fresh
// one. threadId is null while a new conversation has not produced its first reply.
export function useAgentChat(projectKey: string, agentId: number, external: boolean) {
  const t = useTranslations('common.agentChat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  // Mirrors threadId for the send closure, so a send in flight uses the current
  // thread without re-creating the callback on every thread change.
  const threadRef = useRef<string | null>(null);

  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || status !== 'ready') return;

      const assistantId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }], createdAt },
        { id: assistantId, role: 'assistant', parts: [], createdAt },
      ]);
      setStatus(external ? 'queued' : 'streaming');
      setActiveTool(null);

      const growAssistant = (grow: (parts: AiChatPart[]) => AiChatPart[]) =>
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, parts: grow(msg.parts) } : msg)),
        );

      const stream = external ? streamAiAgentChat : streamAiAgentRun;
      try {
        for await (const event of stream(projectKey, agentId, {
          prompt: text,
          threadId: threadRef.current,
        })) {
          switch (event.type) {
            case 'text':
              // The first thing the agent produces is what says a runner took the
              // message, so the wait ends here rather than on a status of its own.
              setStatus('streaming');
              // Writing the answer means the tool it was using is behind it, which is
              // the only end some CLIs report at all.
              setActiveTool(null);
              growAssistant((parts) => appendText(parts, event.value));
              break;
            case 'tool-start':
              setStatus('streaming');
              setActiveTool(event.toolName);
              growAssistant((parts) => [
                ...parts,
                {
                  type: 'tool',
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: event.args,
                },
              ]);
              break;
            case 'tool-args':
              growAssistant((parts) =>
                updateToolPart(parts, event.toolCallId, (tool) => ({
                  ...tool,
                  args: (tool.args ?? '') + event.delta,
                })),
              );
              break;
            case 'tool-end':
              setActiveTool(null);
              if (event.result) {
                growAssistant((parts) =>
                  updateToolPart(parts, event.toolCallId, (tool) => ({
                    ...tool,
                    result: event.result,
                  })),
                );
              }
              break;
            case 'done':
              threadRef.current = event.threadId;
              setThreadId(event.threadId);
              break;
            case 'error':
              toast.error(event.message);
              break;
          }
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t('unreachable'));
      } finally {
        setStatus('ready');
        setActiveTool(null);
        // Drop the assistant placeholder if the agent never produced anything (an error
        // before the first chunk), so an empty bubble is not left behind.
        setMessages((m) => m.filter((msg) => !(msg.id === assistantId && msg.parts.length === 0)));
      }
    },
    [projectKey, agentId, status, external, t],
  );

  // Restores a past conversation: shows its transcript and continues its thread.
  const loadThread = useCallback((id: string, history: AiChatMessage[]) => {
    threadRef.current = id;
    setThreadId(id);
    setMessages(history);
    setStatus('ready');
    setActiveTool(null);
  }, []);

  const prependHistory = useCallback((history: AiChatMessage[]) => {
    setMessages((current) => {
      const existingIds = new Set(current.map((message) => message.id));
      const earlier = history.filter((message) => !existingIds.has(message.id));
      return earlier.length > 0 ? [...earlier, ...current] : current;
    });
  }, []);

  const newChat = useCallback(() => {
    threadRef.current = null;
    setThreadId(null);
    setMessages([]);
    setStatus('ready');
    setActiveTool(null);
  }, []);

  return { messages, status, activeTool, threadId, send, loadThread, prependHistory, newChat };
}
