import { useCallback, useEffect, useState } from 'react';

const RECENT_LIMIT = 10;

// The ids of the projects opened last in this browser, newest first, kept per user.
export function useRecentProjects(userId?: string) {
  const storageKey = `project-switcher:${userId ?? 'anonymous'}:recent`;
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      setIds(Array.isArray(stored) ? stored.filter(Number.isInteger) : []);
    } catch {
      setIds([]);
    }
  }, [storageKey]);

  const record = useCallback(
    (id: number) =>
      setIds((previous) => {
        const next = [id, ...previous.filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // The list still applies for this session when browser storage is unavailable.
        }
        return next;
      }),
    [storageKey],
  );

  return { ids, record };
}
