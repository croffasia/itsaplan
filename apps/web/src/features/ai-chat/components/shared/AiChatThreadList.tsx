'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAgentFavoriteThreadsQuery,
  useAgentThreadsQuery,
  useDeleteAgentThread,
  useToggleAgentThreadFavorite,
} from '@/services/aiAgents.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Input } from '@/components/ui/input';
import type { AiChatThread } from '@/lib/api';
import { AiChatThreadItem } from './AiChatThreadItem';
import { AiChatThreadItemSkeleton } from './AiChatThreadItemSkeleton';

// Below this the search runs nothing, the way the API reads it: one character matches
// nearly every conversation.
const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 300;

// The caller's own past conversations with one agent, newest first, loaded a page at a
// time as the end of the list comes into view. The host supplies the header around it.
// `selectedThreadId` marks the conversation currently shown; a thread that has not
// produced its first reply yet has no id and so is not in this list. Deleting a
// conversation removes it and its messages; `onDeleted` lets the host reset the chat
// when the deleted one was open.
//
// The starred conversations are shown as a group of their own on top, and the list
// below holds the rest, so a conversation appears once. A search replaces both with its
// hits, over all of them.
export function AiChatThreadList({
  projectKey,
  agentId,
  selectedThreadId,
  onSelect,
  onDeleted,
}: {
  projectKey: string;
  agentId: number;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  onDeleted: (threadId: string) => void;
}) {
  const t = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const search = debounced.length >= MIN_QUERY ? debounced : '';

  const threadsQuery = useAgentThreadsQuery(projectKey, agentId, search);
  const threads = threadsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = threadsQuery;
  const favoritesQuery = useAgentFavoriteThreadsQuery(projectKey, agentId);
  const favorites = search ? [] : (favoritesQuery.data?.items ?? []);
  const toggleFavorite = useToggleAgentThreadFavorite(projectKey, agentId);
  const deleteThread = useDeleteAgentThread(projectKey, agentId);
  const [pending, setPending] = useState<AiChatThread | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      // Start loading a bit before the sentinel is fully visible.
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function confirmDelete() {
    if (!pending) return;
    await deleteThread.mutateAsync(pending.id);
    setPending(null);
    onDeleted(pending.id);
  }

  const renderThread = (thread: AiChatThread) => (
    <AiChatThreadItem
      key={thread.id}
      thread={thread}
      active={thread.id === selectedThreadId}
      query={search}
      onSelect={() => onSelect(thread.id)}
      onToggleFavorite={() =>
        toggleFavorite.mutate({ threadId: thread.id, favorite: !thread.favorite })
      }
      onDelete={() => setPending(thread)}
    />
  );

  function renderList() {
    if (threadsQuery.isLoading) {
      return Array.from({ length: 5 }).map((_, i) => <AiChatThreadItemSkeleton key={i} />);
    }
    if (threads.length === 0 && favorites.length === 0) {
      return (
        <div className="px-2 py-6 text-center text-xs text-muted-foreground">
          {search ? t('noMatches') : t('noThreads')}
        </div>
      );
    }
    return (
      <>
        {favorites.length > 0 && (
          <>
            <ListLabel>{t('favorites')}</ListLabel>
            {favorites.map(renderThread)}
            {threads.length > 0 && <ListLabel>{t('otherThreads')}</ListLabel>}
          </>
        )}
        {threads.map(renderThread)}
        <div ref={sentinelRef} />
        {isFetchingNextPage && <AiChatThreadItemSkeleton />}
      </>
    );
  }

  return (
    <>
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchThreads')}
          className="h-8 ps-8 text-sm"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">{renderList()}</div>

      {pending && (
        <ConfirmDialog
          title={t('deleteThread')}
          confirmLabel={tCommon('delete')}
          onConfirm={confirmDelete}
          onClose={() => setPending(null)}
        >
          <div className="text-sm text-muted-foreground">
            {t('deleteThreadConfirm', { title: pending.title ?? t('untitledThread') })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

function ListLabel({ children }: { children: string }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">{children}</div>
  );
}
