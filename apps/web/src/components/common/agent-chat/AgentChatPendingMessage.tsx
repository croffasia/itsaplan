'use client';

import { X } from 'lucide-react';
import type { PendingMessage } from '@/hooks/useAgentChat';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import { MessageScrollerItem } from '@/components/ui/message-scroller';
import { useTranslations } from 'next-intl';

export default function AgentChatPendingMessage({
  message,
  onRemove,
}: {
  message: PendingMessage;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('common.agentChat');

  return (
    <MessageScrollerItem
      messageId={message.id}
      className="motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
    >
      <Message align="end">
        <MessageContent>
          <Bubble variant="muted" className="gap-2 opacity-60">
            <BubbleContent>
              <span className="whitespace-pre-wrap" dir="auto">
                {message.text}
              </span>
            </BubbleContent>
          </Bubble>
          <MessageFooter className="gap-1">
            <span>{t('waitingToSend')}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-5 text-muted-foreground hover:text-foreground"
              onClick={() => onRemove(message.id)}
            >
              <X className="size-3" />
              <span className="sr-only">{t('removePending')}</span>
            </Button>
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
