'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, streamHermesConversation, type AiChatMessage } from '@/lib/api';
import { useHermesMessagesQuery } from '@/services/aiAgents.service';
import { qk } from '@/services/queryKeys';
import type { ChatStatus } from '@/hooks/useAgentChat';

export function useHermesChat(projectKey: string, agentId: number, conversationId: string) {
  const queryClient = useQueryClient();
  const messagesQuery = useHermesMessagesQuery(projectKey, conversationId);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    if (messagesQuery.data && status === 'ready') setMessages(messagesQuery.data);
  }, [messagesQuery.data, status]);

  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || status === 'streaming') return;
      const assistantId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', text, createdAt },
        { id: assistantId, role: 'assistant', text: '', createdAt },
      ]);
      setStatus('streaming');
      setActiveTool(null);
      try {
        for await (const event of streamHermesConversation(
          projectKey,
          conversationId,
          text,
          crypto.randomUUID(),
        )) {
          if (event.type === 'text') {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, text: message.text + event.value }
                  : message,
              ),
            );
          } else if (event.type === 'tool-start') {
            setActiveTool(event.toolName);
          } else if (event.type === 'tool-end') {
            setActiveTool(null);
          } else if (event.type === 'error') {
            toast.error(event.message);
          }
        }
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'Could not reach Bob. Try again.');
      } finally {
        setStatus('ready');
        setActiveTool(null);
        setMessages((current) =>
          current.filter((message) => !(message.id === assistantId && message.text === '')),
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: qk.hermesMessages(projectKey, conversationId),
          }),
          queryClient.invalidateQueries({ queryKey: qk.hermesConversations(projectKey, agentId) }),
          queryClient.invalidateQueries({ queryKey: qk.chatDashboardSummary(projectKey) }),
        ]);
      }
    },
    [agentId, conversationId, projectKey, queryClient, status],
  );

  return {
    messages,
    status,
    activeTool,
    send,
    isLoading: messagesQuery.isLoading,
  };
}
