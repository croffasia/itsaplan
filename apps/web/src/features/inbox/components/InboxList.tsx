'use client';

import { useEffect, useRef } from 'react';
import { type Notification } from '@/lib/api';
import InboxListItem from './InboxListItem';

// The scrollable notification list. Empty and loading states render in place. New
// pages load automatically when the bottom sentinel scrolls into view; selection
// and paging are owned by the page.
export default function InboxList({
  items,
  isLoading,
  selectedId,
  onSelect,
  onToggleRead,
  onSnooze,
  onDelete,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  items: Notification[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (n: Notification) => void;
  onToggleRead: (n: Notification, read: boolean) => void;
  onSnooze: (n: Notification, until: string | null) => void;
  onDelete: (n: Notification) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) onLoadMore();
      },
      // Start loading a bit before the sentinel is fully visible.
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No notifications
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {items.map((n) => (
        <InboxListItem
          key={n.id}
          notification={n}
          selected={n.id === selectedId}
          onSelect={() => onSelect(n)}
          onToggleRead={(read) => onToggleRead(n, read)}
          onSnooze={(until) => onSnooze(n, until)}
          onDelete={() => onDelete(n)}
        />
      ))}
      {hasNextPage && <div ref={sentinelRef} className="h-px" />}
      {isFetchingNextPage && (
        <div className="py-3 text-center text-xs text-muted-foreground">Loading…</div>
      )}
    </div>
  );
}
