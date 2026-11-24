'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import {
  useFavoriteChatThreadsQuery,
  useToggleChatThreadFavorite,
} from '@/services/aiAgents.service';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Stars the open conversation. Its state comes from the same favorites request the
// history reads, so the two always agree.
export function ChatPanelFavorite({
  projectKey,
  thread,
}: {
  projectKey: string;
  thread: Pick<AiChatThread, 'id' | 'agentId'>;
}) {
  const t = useTranslations('aiChat');
  const favorites = useFavoriteChatThreadsQuery(projectKey).data?.items ?? [];
  const toggleFavorite = useToggleChatThreadFavorite(projectKey);
  const favorite = favorites.some((one) => one.id === thread.id);
  const label = t(favorite ? 'removeFavorite' : 'addFavorite');

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
      title={label}
      aria-pressed={favorite}
      onClick={() => toggleFavorite.mutate({ thread, favorite: !favorite })}
    >
      <Star className={cn(favorite && 'fill-current text-amber-500')} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
