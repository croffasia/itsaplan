'use client';

import type { ChatMessage } from '@/hooks/useAgentChat';
import { cn } from '@/lib/utils';
import type { AiChatPart, AiChatToolPart } from '@/lib/api/endpoints/agentChat';
import { formatLongDate, formatTime } from '@/utils/dates';
import Markdown from '@/components/common/Markdown';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message';
import { MessageScrollerItem } from '@/components/ui/message-scroller';
import AgentChatToolCalls from './AgentChatToolCalls';
import AgentTile from './AgentTile';
import AgentChatUserText from './AgentChatUserText';
import { useTranslations } from 'next-intl';

type Block = { text: string } | { tools: AiChatToolPart[] };

// Tool calls that follow one another are shown as one block, in the place between the
// two stretches of text where they were made.
function blocksOf(parts: AiChatPart[]): Block[] {
  const blocks: Block[] = [];
  for (const part of parts) {
    if (part.type === 'text') {
      blocks.push({ text: part.text });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && 'tools' in last) last.tools.push(part);
    else blocks.push({ tools: [part] });
  }
  return blocks;
}

// The time of a message is there while it is pointed at, and always on a touch screen.
// `statusLabel` is what the agent is doing while it writes this message.
export default function AgentChatMessage({
  message,
  agentName,
  showDate,
  statusLabel,
}: {
  message: ChatMessage;
  agentName: string;
  showDate: boolean;
  statusLabel: string | null;
}) {
  const t = useTranslations('common.agentChat');
  const isUser = message.role === 'user';
  const blocks = blocksOf(message.parts);
  const time = (
    <time
      dateTime={message.createdAt}
      className="shrink-0 text-xs text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover/message:opacity-100 [@media(hover:none)]:opacity-100"
    >
      {formatTime(message.createdAt)}
    </time>
  );

  return (
    <MessageScrollerItem
      messageId={message.id}
      scrollAnchor={isUser}
      className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
    >
      {showDate && (
        <p className="text-center text-xs text-muted-foreground">
          {formatLongDate(message.createdAt)}
        </p>
      )}
      <Message align={isUser ? 'end' : 'start'}>
        <MessageContent>
          {!isUser && (
            <MessageHeader className="gap-2 text-foreground">
              <AgentTile />
              <span className="truncate text-[13px] font-semibold">{agentName}</span>
              {time}
            </MessageHeader>
          )}
          <div className={cn('flex min-w-0 items-center gap-3', isUser && 'justify-end')}>
            {isUser && time}
            <Bubble
              variant={isUser ? 'muted' : 'ghost'}
              className={cn('gap-3', !isUser && 'w-full')}
            >
              {blocks.map((block, index) =>
                'tools' in block ? (
                  <AgentChatToolCalls key={index} tools={block.tools} />
                ) : (
                  <BubbleContent
                    key={index}
                    className={isUser ? 'rounded-2xl rounded-ee-sm' : 'w-full'}
                  >
                    {isUser ? (
                      <AgentChatUserText text={block.text} />
                    ) : (
                      // Only the last block is still written to.
                      <Markdown complete={statusLabel === null || index < blocks.length - 1}>
                        {block.text}
                      </Markdown>
                    )}
                  </BubbleContent>
                ),
              )}
              {statusLabel !== null && (
                <Marker role="status">
                  <MarkerContent className="shimmer">{statusLabel}</MarkerContent>
                </Marker>
              )}
            </Bubble>
          </div>
          {message.error && <p className="text-xs text-destructive">{message.error}</p>}
          {message.stopped && <MessageFooter>{t('stopped')}</MessageFooter>}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
