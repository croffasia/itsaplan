'use client';

import type { ChatMessage } from '@/hooks/useAgentChat';
import { cn } from '@/lib/utils';
import type { AiChatPart, AiChatToolPart } from '@/lib/api';
import { formatLongDate, formatTime } from '@/utils/dates';
import Markdown from '@/components/common/Markdown';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import { MessageScrollerItem } from '@/components/ui/message-scroller';
import AgentChatToolCalls from './AgentChatToolCalls';
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

export default function AgentChatMessage({
  message,
  showDate,
}: {
  message: ChatMessage;
  showDate: boolean;
}) {
  const t = useTranslations('common.agentChat');
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
          <Bubble variant={isUser ? 'muted' : 'ghost'} className={cn('gap-2', !isUser && 'w-full')}>
            {blocksOf(message.parts).map((block, index) =>
              'tools' in block ? (
                <AgentChatToolCalls key={index} tools={block.tools} />
              ) : (
                <BubbleContent key={index} className={cn(!isUser && 'w-full')}>
                  {isUser ? (
                    <AgentChatUserText text={block.text} />
                  ) : (
                    <Markdown>{block.text}</Markdown>
                  )}
                </BubbleContent>
              ),
            )}
          </Bubble>
          {message.error && <p className="text-xs text-destructive">{message.error}</p>}
          <MessageFooter>
            {message.stopped
              ? `${t('stopped')} · ${formatTime(message.createdAt)}`
              : formatTime(message.createdAt)}
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
