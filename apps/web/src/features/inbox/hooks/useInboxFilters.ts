import { useCallback, useState } from 'react';
import { PRIORITY_INBOX_TYPES, type NotificationFilters } from '@/lib/api/endpoints/notifications';

// The inbox toolbar's type filter and display toggles, kept per project in
// localStorage so reopening the inbox restores the last choices. A missing type
// list is the priority inbox: assignment, mention, comment — not every state
// change.

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

function withDefaultTypes(filters: NotificationFilters): NotificationFilters {
  return filters.types ? filters : { ...filters, types: [...PRIORITY_INBOX_TYPES] };
}

export function useInboxFilters(projectKey: string) {
  const [filters, setFilters] = useState<NotificationFilters>(() =>
    withDefaultTypes(readStore()[projectKey] ?? {}),
  );

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
