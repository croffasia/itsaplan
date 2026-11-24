'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { useChatThreadsQuery, useFavoriteChatThreadsQuery } from '@/services/aiAgents.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import SearchInput from '@/components/common/SearchInput';
import { ChatPanelDelete } from './ChatPanelDelete';
import { ChatPanelListItem } from './ChatPanelListItem';
import { ChatPanelListSkeleton } from './ChatPanelListSkeleton';
import { ChatPanelListThread } from './ChatPanelListThread';
import { useChatSessionTitle } from '../../hooks/useChatSessionTitle';
import type { ChatSession, ChatSessions } from '../../hooks/useChatSessions';
import { threadGroups } from '../../utils/threadGroups';

// Below this the search runs nothing, the way the API reads it: one character matches
// nearly every conversation.
const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 300;

// The caller's own conversations with the project's agents, newest first, loaded a page at
// a time as the end of the list comes into view. The ones that are answering stand first,
// then the starred ones, then the rest by day, so a conversation appears once. A search
// replaces all of them with its hits. `children` go next to the search.
export function ChatPanelList({
  projectKey,
  agents,
  chats,
  onPicked,
  children,
}: {
  projectKey: string;
  agents: AiAgent[];
  chats: ChatSessions;
  onPicked?: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations('aiChat');
  const tRuns = useTranslations('issue.agentRuns');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const search = debounced.length >= MIN_QUERY ? debounced : '';

  const threadsQuery = useChatThreadsQuery(projectKey, search);
  const threads = threadsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = threadsQuery;
  const favorites = useFavoriteChatThreadsQuery(projectKey).data?.items ?? [];
  const titleOf = useChatSessionTitle(projectKey);
  const [deleting, setDeleting] = useState<AiChatThread | null>(null);

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

  const answering = chats.sessions.filter((session) => session.running);
  // With an agent that keeps no memory there is no thread, so the history has no row of it.
  const unsaved = chats.sessions.filter(
    (session) => !session.running && !session.threadId && session.hasMessages,
  );
  const answeringIds = new Set(answering.flatMap(({ threadId }) => threadId ?? []));
  const starred = favorites.filter((thread) => !answeringIds.has(thread.id));
  const { today, earlier } = threadGroups(threads, answeringIds);

  const agentName = (id: number) => agents.find((agent) => agent.id === id)?.name ?? '';
  const pick = (open: () => void) => {
    open();
    onPicked?.();
  };

  const sessionRow = (session: ChatSession) => (
    <ChatPanelListItem
      key={session.id}
      title={titleOf(session)}
      agentName={agentName(session.agentId)}
      answering={session.running}
      active={session.id === chats.active?.id}
      onSelect={() => pick(() => chats.show(session.id))}
    />
  );

  const threadRow = (thread: AiChatThread) => (
    <ChatPanelListThread
      key={thread.id}
      projectKey={projectKey}
      thread={thread}
      agentName={agentName(thread.agentId)}
      active={thread.id === chats.active?.threadId}
      query={search}
      onSelect={() => pick(() => chats.openThread(thread))}
      onDelete={() => setDeleting(thread)}
    />
  );

  const groups: [string, ReactNode[]][] = search
    ? [['', threads.map(threadRow)]]
    : [
        [tRuns('activeSection'), answering.map(sessionRow)],
        [t('favorites'), starred.map(threadRow)],
        [t('today'), [...unsaved.map(sessionRow), ...today.map(threadRow)]],
        [t('earlier'), earlier.map(threadRow)],
      ];
  const shown = groups.filter(([, rows]) => rows.length > 0);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 p-3 pb-1">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('searchThreads')}
          className="min-w-0 flex-1"
        />
        {children}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {threadsQuery.isLoading &&
          Array.from({ length: 5 }, (_, i) => <ChatPanelListSkeleton key={i} />)}
        {!threadsQuery.isLoading && shown.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t(search ? 'noMatches' : 'noThreads')}
          </p>
        )}
        {shown.map(([label, rows]) => (
          <section key={label}>
            <h3 className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground empty:hidden">
              {label}
            </h3>
            {rows}
          </section>
        ))}
        <div ref={sentinelRef} />
        {isFetchingNextPage && <ChatPanelListSkeleton />}
      </div>

      {deleting && (
        <ChatPanelDelete
          projectKey={projectKey}
          thread={deleting}
          onDeleted={() => chats.dropThread(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
