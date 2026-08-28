'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAgentFavoriteThreadsQuery,
  useToggleAgentThreadFavorite,
} from '@/services/aiAgents.service';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Stars the conversation of the tab that is open, from the tab row. Its state comes
// from the same favorites request the history popover reads, so the two always agree.
// The host mounts it only for a chat that has a thread: one that has not started, and
// one with an agent that keeps no memory, have nothing to star.
export function ChatPanelTabFavorite({
  projectKey,
  agentId,
  threadId,
}: {
  projectKey: string;
  agentId: number;
  threadId: string;
}) {
  const t = useTranslations('aiChat');
  const favoritesQuery = useAgentFavoriteThreadsQuery(projectKey, agentId);
  const toggleFavorite = useToggleAgentThreadFavorite(projectKey, agentId);
  const favorite = favoritesQuery.data?.items.some((thread) => thread.id === threadId) ?? false;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
      title={t(favorite ? 'removeFavorite' : 'addFavorite')}
      aria-pressed={favorite}
      onClick={() => toggleFavorite.mutate({ threadId, favorite: !favorite })}
    >
      <Star className={cn(favorite && 'fill-current text-amber-500')} />
      <span className="sr-only">{t(favorite ? 'removeFavorite' : 'addFavorite')}</span>
    </Button>
  );
}
