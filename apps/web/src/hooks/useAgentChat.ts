'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, streamAiAgentRun } from '@/lib/api';
import type { AiChatMessage } from '@/lib/api';

export type ChatMessage = AiChatMessage;

export type ChatStatus = 'ready' | 'streaming';

// Drives one conversation with an internal agent. Sends a prompt, streams the
// response over SSE (see streamAiAgentRun), and exposes the running transcript, the
// stream status, and the tool the agent is currently using (for the status marker).
//
// When the agent has memory enabled, the run belongs to a conversation thread: the
// thread id returned by the first message is kept so follow-up messages continue it,
// and it is surfaced as `threadId` so the host can reflect the new thread in the
// history list. loadThread() restores a past conversation; newChat() starts a fresh
// one. threadId is null while a new conversation has not produced its first reply.
export function useAgentChat(projectKey: string, agentId: number) {
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
      if (!text || status === 'streaming') return;

      const assistantId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'user', text, createdAt },
        { id: assistantId, role: 'assistant', text: '', createdAt },
      ]);
      setStatus('streaming');
      setActiveTool(null);

      const appendToAssistant = (chunk: string) =>
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, text: msg.text + chunk } : msg)),
        );

      try {
        for await (const event of streamAiAgentRun(projectKey, agentId, {
          prompt: text,
          threadId: threadRef.current,
        })) {
          switch (event.type) {
            case 'text':
              appendToAssistant(event.value);
              break;
            case 'tool-start':
              setActiveTool(event.toolName);
              break;
            case 'tool-end':
              setActiveTool(null);
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
        toast.error(
          err instanceof ApiError ? err.message : 'Could not reach the agent. Try again.',
        );
      } finally {
        setStatus('ready');
        setActiveTool(null);
        // Drop the assistant placeholder if it never received any text (an error
        // before the first chunk), so an empty bubble is not left behind.
        setMessages((m) => m.filter((msg) => !(msg.id === assistantId && msg.text === '')));
      }
    },
    [projectKey, agentId, status],
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

  // Starts a fresh conversation (no thread yet).
  const newChat = useCallback(() => {
    threadRef.current = null;
    setThreadId(null);
    setMessages([]);
    setStatus('ready');
    setActiveTool(null);
  }, []);

  return { messages, status, activeTool, threadId, send, loadThread, prependHistory, newChat };
}
