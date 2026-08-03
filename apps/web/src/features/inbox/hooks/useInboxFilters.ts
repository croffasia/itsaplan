import { useCallback, useState } from 'react';
import { type NotificationFilters } from '@/lib/api';

// The inbox toolbar's type filter and display toggles, kept per project in
// localStorage so reopening the inbox restores the last choices.

const STORE_KEY = 'planner_inbox_filters';

type Store = Record<string, NotificationFilters>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function useInboxFilters(projectKey: string) {
  const [filters, setFilters] = useState<NotificationFilters>(() => readStore()[projectKey] ?? {});

  const changeFilters = useCallback(
    (next: NotificationFilters) => {
      setFilters(next);
      const store = readStore();
      store[projectKey] = next;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
      } catch {
        // Storage unavailable (private mode / quota): the filters still apply.
      }
    },
    [projectKey],
  );

  return { filters, changeFilters };
}
