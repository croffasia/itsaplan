'use client';

import { useEffect, useRef } from 'react';
import type { UIEvent, WheelEvent } from 'react';
import type { ChatMessage, ChatStatus, PendingMessage } from '@/hooks/useAgentChat';
import { dayKey } from '@/utils/dates';
import AgentChatMessage from './AgentChatMessage';
import AgentChatPendingMessage from './AgentChatPendingMessage';
import InitialScrollToEnd from './InitialScrollToEnd';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { useTranslations } from 'next-intl';

const loadThreshold = 48;

export function AgentChatTranscript({
  messages,
  status,
  activeTool,
  pending,
  onRemovePending,
  hasEarlierMessages = false,
  isLoadingEarlier = false,
  onLoadEarlier,
}: {
  messages: ChatMessage[];
  status: ChatStatus;
  activeTool: string | null;
  pending: PendingMessage[];
  onRemovePending: (id: string) => void;
  hasEarlierMessages?: boolean;
  isLoadingEarlier?: boolean;
  onLoadEarlier?: () => void;
}) {
  const t = useTranslations('common.agentChat');

  let statusLabel: string;
  if (status === 'queued') statusLabel = t('waitingForRunner');
  else if (activeTool) statusLabel = t('usingTool', { tool: activeTool });
  else statusLabel = t('thinking');

  const loadLocked = useRef(false);
  const hasLeftStart = useRef(false);

  useEffect(() => {
    if (!isLoadingEarlier) loadLocked.current = false;
  }, [isLoadingEarlier]);

  function loadEarlier() {
    if (!hasEarlierMessages || isLoadingEarlier || loadLocked.current || !onLoadEarlier) return;
    loadLocked.current = true;
    onLoadEarlier();
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const { scrollTop } = event.currentTarget;
    if (scrollTop > loadThreshold) hasLeftStart.current = true;
    if (scrollTop <= loadThreshold && hasLeftStart.current) loadEarlier();
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.deltaY < 0 && event.currentTarget.scrollTop <= loadThreshold) {
      hasLeftStart.current = true;
      loadEarlier();
    }
  }

  return (
    <MessageScroller>
      <InitialScrollToEnd hasMessages={messages.length > 0} />
      {isLoadingEarlier && (
        <Marker
          role="status"
          className="absolute top-3 left-1/2 z-10 w-auto -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1 shadow-sm backdrop-blur-sm"
        >
          <MarkerContent className="shimmer">{t('loadingEarlier')}</MarkerContent>
        </Marker>
      )}
      <MessageScrollerViewport
        aria-label={t('messages')}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <MessageScrollerContent
          aria-busy={status !== 'ready' || isLoadingEarlier}
          className="mx-auto w-full max-w-3xl gap-6 p-4 pb-10"
        >
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            return (
              <AgentChatMessage
                key={message.id}
                message={message}
                showDate={!previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)}
              />
            );
          })}

          {status !== 'ready' && (
            <MessageScrollerItem messageId="stream-status">
              <Marker role="status">
                <MarkerContent className="shimmer">{statusLabel}</MarkerContent>
              </Marker>
            </MessageScrollerItem>
          )}

          {pending.map((message) => (
            <AgentChatPendingMessage
              key={message.id}
              message={message}
              onRemove={onRemovePending}
            />
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  );
}
