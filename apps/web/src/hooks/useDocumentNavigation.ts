import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSession } from '@/lib/auth-client';

const CHANGE_EVENT = 'document-navigation-change';
const empty = () => '';
const memory = new Map<string, string>();
function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
function read(key: string | null) {
  if (!key || typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(key) ?? memory.get(key) ?? '';
  } catch {
    return memory.get(key) ?? '';
  }
}
function parse<T extends object>(raw: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const result = { ...fallback };
    for (const key of Object.keys(fallback) as Array<keyof T>) {
      const item = (value as T)[key],
        defaultValue = fallback[key];
      if (Array.isArray(defaultValue)) {
        if (Array.isArray(item))
          result[key] = item.filter(
            (entry) => typeof entry === 'number' && Number.isSafeInteger(entry),
          ) as T[keyof T];
      } else if (defaultValue === null) {
        if (item === null || typeof item === 'string') result[key] = item;
      } else if (
        typeof item === typeof defaultValue &&
        (typeof item !== 'number' || Number.isFinite(item))
      )
        result[key] = item;
    }
    return result;
  } catch {
    return fallback;
  }
}

export function useDocumentNavigation<T extends object>(
  projectKey: string | null,
  section: string,
  fallback: T,
) {
  const { data: session } = useSession();
  const key =
    session?.user.id && projectKey ? `docs-nav:${session.user.id}:${projectKey}:${section}` : null;
  const getSnapshot = useCallback(() => read(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, empty);
  const value = useMemo(() => parse(raw, fallback), [raw, fallback]);
  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      if (!key) return;
      const resolved = typeof next === 'function' ? next(parse(read(key), fallback)) : next;
      const serialized = JSON.stringify(resolved);
      memory.set(key, serialized);
      try {
        window.sessionStorage.setItem(key, serialized);
      } catch {
        /* Session memory remains available. */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, fallback],
  );
  return [value, setValue] as const;
}

const recentDefault: { ids: number[] } = { ids: [] };
export function useRecentDocuments(projectKey: string | null) {
  const [recent, update] = useDocumentNavigation(projectKey, 'recent', recentDefault);
  const visit = useCallback(
    (id: number) =>
      update((previous) => ({
        ids: [
          id,
          ...(Array.isArray(previous.ids) ? previous.ids : []).filter((item) => item !== id),
        ].slice(0, 12),
      })),
    [update],
  );
  return { ids: Array.isArray(recent.ids) ? recent.ids : [], visit };
}
