'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, streamAiAgentChat, streamAiAgentRun } from '@/lib/api';
import type { AiChatMessage, AiChatPart, AiChatToolPart } from '@/lib/api';
import { uuid } from '@/utils/uuid';
import { useTranslations } from 'next-intl';

// `error` is what a stream that failed left behind. It is not part of a stored
// transcript: a restored thread holds the answer the agent produced, not the run that
// broke.
export type ChatMessage = AiChatMessage & { error?: string };

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

// A message typed while the agent was answering, waiting for its turn.
export type PendingMessage = { id: string; text: string };

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
//
// A message sent while a reply is running is held in `pending` and sent on its own once
// that reply ends, one at a time and in the order it was typed. A reply that failed
// pauses the queue: what is left waits until the next send, so a message is not thrown
// at an agent that is not answering. A stop is not a failure — it ends the reply being
// produced and the message waiting behind it is sent next.
//
// stop() ends the reply being produced. What the agent wrote before it stays in the
// transcript, marked stopped. An internal agent's run is bound to the stream, so
// dropping it is the stop; an external one is answered on the operator's machine and is
// stopped through the API, which its runner reads on its next report.
export function useAgentChat(projectKey: string, agentId: number, external: boolean) {
  const t = useTranslations('common.agentChat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  // Mirrors threadId for the send closure, so a send in flight uses the current
  // thread without re-creating the callback on every thread change.
  const threadRef = useRef<string | null>(null);

  const [pending, setPending] = useState<PendingMessage[]>([]);
  // A running turn is held twice: the ref so a second send in the same frame sees it
  // before the re-render, the state so the end of a turn re-runs the drain effect.
  // `status` cannot do that job — loadThread sets it to 'ready' while a turn it did
  // not start is still streaming, and the end of that turn then changes nothing.
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [queuePaused, setQueuePaused] = useState(false);
  const stopRef = useRef<AbortController | null>(null);

  const runTurn = useCallback(
    async (text: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      const stopper = new AbortController();
      stopRef.current = stopper;
      // Kept for the transcript rather than reported at once: the session may not be
      // the one on screen, and the answer is where the user looks for what happened.
      let failure: string | null = null;

      const assistantId = uuid();
      const createdAt = new Date().toISOString();
      setMessages((m) => [
        ...m,
        { id: uuid(), role: 'user', parts: [{ type: 'text', text }], createdAt },
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
        for await (const event of stream(
          projectKey,
          agentId,
          { prompt: text, threadId: threadRef.current },
          stopper.signal,
        )) {
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
              failure = event.message;
              setQueuePaused(true);
              break;
          }
        }
      } catch (err) {
        // A stop ends the stream by aborting it; that is what was asked for, not a
        // failure to report, and the queue behind it goes on.
        if (!stopper.signal.aborted) {
          failure = err instanceof ApiError ? err.message : t('unreachable');
          setQueuePaused(true);
        }
      } finally {
        runningRef.current = false;
        stopRef.current = null;
        setRunning(false);
        setStatus('ready');
        setActiveTool(null);
        // Drop the assistant placeholder if the agent never produced anything and there
        // is nothing to say about it, so an empty bubble is not left behind. A failure
        // keeps the bubble: it carries the message.
        const stopped = stopper.signal.aborted;
        setMessages((m) =>
          m
            .filter((msg) => !(msg.id === assistantId && msg.parts.length === 0 && !failure))
            .map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    ...(stopped && { stopped: true }),
                    ...(failure && { error: failure }),
                  }
                : msg,
            ),
        );
      }
    },
    [projectKey, agentId, external, t],
  );

  const send = useCallback(
    (prompt: string) => {
      const text = prompt.trim();
      if (!text) return;
      setQueuePaused(false);
      if (runningRef.current || pending.length > 0) {
        setPending((queue) => [...queue, { id: uuid(), text }]);
        return;
      }
      void runTurn(text);
    },
    [pending, runTurn],
  );

  const removePending = useCallback((id: string) => {
    setPending((queue) => queue.filter((message) => message.id !== id));
  }, []);

  // Ends the reply being produced. What is queued behind it is sent next: stopping this
  // reply is what clears the way for the message typed while it ran.
  const stop = useCallback(() => {
    stopRef.current?.abort();
  }, []);

  // Sends the next waiting message once the reply before it has ended.
  useEffect(() => {
    if (queuePaused || running || runningRef.current || pending.length === 0) return;
    const [next] = pending;
    setPending((queue) => queue.filter((message) => message.id !== next.id));
    void runTurn(next.text);
  }, [queuePaused, running, pending, runTurn]);

  // Restores a past conversation: shows its transcript and continues its thread.
  const loadThread = useCallback((id: string, history: AiChatMessage[]) => {
    threadRef.current = id;
    setThreadId(id);
    setMessages(history);
    setStatus('ready');
    setActiveTool(null);
    setPending([]);
    setQueuePaused(false);
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
    setPending([]);
    setQueuePaused(false);
  }, []);

  return {
    messages,
    status,
    activeTool,
    threadId,
    pending,
    send,
    stop,
    removePending,
    loadThread,
    prependHistory,
    newChat,
  };
}
