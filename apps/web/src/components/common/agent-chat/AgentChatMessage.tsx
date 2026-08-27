'use client';

import type { ReactNode } from 'react';
import type { ChatMessage } from '@/hooks/useAgentChat';
import { cn } from '@/lib/utils';
import type { AiChatPart, AiChatToolPart } from '@/lib/api';
import { formatLongDate, formatTime } from '@/utils/dates';
import Markdown from '@/components/common/Markdown';
import { FILE_MARKER, fileMarkerUrl } from '@/lib/markdown';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import { MessageScrollerItem } from '@/components/ui/message-scroller';
import AgentChatToolCalls from './AgentChatToolCalls';
import { useTranslations } from 'next-intl';

type Block = { text: string } | { tools: AiChatToolPart[] };

// The user bubble shows plain text, except the marker an attached file arrives
// as, which renders as the file name with a download link (see lib/markdown.ts).
function UserMessageText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(new RegExp(FILE_MARKER))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={parts.length}
        href={fileMarkerUrl(match[2])}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {match[1]}
      </a>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <span className="whitespace-pre-wrap">{parts}</span>;
}

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
                    <UserMessageText text={block.text} />
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
