'use client';

import { useEffect, useRef } from 'react';
import type { UIEvent, WheelEvent } from 'react';
import type { ChatMessage } from '@/hooks/useAgentChat';
import { dayKey } from '@/utils/dates';
import AgentChatMessage from './AgentChatMessage';
import InitialScrollToEnd from './InitialScrollToEnd';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';

const loadThreshold = 48;

export function AgentChatTranscript({
  messages,
  isStreaming,
  activeTool,
  hasEarlierMessages = false,
  isLoadingEarlier = false,
  onLoadEarlier,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeTool: string | null;
  hasEarlierMessages?: boolean;
  isLoadingEarlier?: boolean;
  onLoadEarlier?: () => void;
}) {
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
          <MarkerContent className="shimmer">Loading earlier messages…</MarkerContent>
        </Marker>
      )}
      <MessageScrollerViewport
        aria-label="Conversation messages"
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <MessageScrollerContent
          aria-busy={isStreaming || isLoadingEarlier}
          className="mx-auto w-full max-w-3xl gap-6 p-4"
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

          {isStreaming && (
            <MessageScrollerItem messageId="stream-status">
              <Marker role="status">
                <MarkerContent className="shimmer">
                  {activeTool ? `Using ${activeTool}…` : 'Thinking…'}
                </MarkerContent>
              </Marker>
            </MessageScrollerItem>
          )}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  );
}
