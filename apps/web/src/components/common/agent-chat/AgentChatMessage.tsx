'use client';

import type { ChatMessage } from '@/hooks/useAgentChat';
import { formatLongDate, formatTime } from '@/utils/dates';
import Markdown from '@/components/common/Markdown';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import { MessageScrollerItem } from '@/components/ui/message-scroller';

export default function AgentChatMessage({
  message,
  showDate,
}: {
  message: ChatMessage;
  showDate: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <MessageScrollerItem
      messageId={message.id}
      scrollAnchor={isUser}
      className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
    >
      {showDate && (
        <Marker variant="separator">
          <MarkerContent>{formatLongDate(message.createdAt)}</MarkerContent>
        </Marker>
      )}
      <Message align={isUser ? 'end' : 'start'}>
        <MessageContent>
          <Bubble variant={isUser ? 'muted' : 'ghost'}>
            <BubbleContent>
              {isUser ? (
                <span className="whitespace-pre-wrap">{message.text}</span>
              ) : (
                <Markdown>{message.text}</Markdown>
              )}
            </BubbleContent>
          </Bubble>
          <MessageFooter>{formatTime(message.createdAt)}</MessageFooter>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
