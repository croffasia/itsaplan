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
type StorageKind = 'session' | 'local';
const storageOf = (kind: StorageKind) =>
  kind === 'local' ? window.localStorage : window.sessionStorage;
function read(key: string | null, kind: StorageKind) {
  if (!key || typeof window === 'undefined') return '';
  try {
    return storageOf(kind).getItem(key) ?? memory.get(key) ?? '';
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
  storage: StorageKind = 'session',
) {
  const { data: session } = useSession();
  const key =
    session?.user.id && projectKey ? `docs-nav:${session.user.id}:${projectKey}:${section}` : null;
  const getSnapshot = useCallback(() => read(key, storage), [key, storage]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, empty);
  const value = useMemo(() => parse(raw, fallback), [raw, fallback]);
  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      if (!key) return;
      const resolved =
        typeof next === 'function' ? next(parse(read(key, storage), fallback)) : next;
      const serialized = JSON.stringify(resolved);
      memory.set(key, serialized);
      try {
        storageOf(storage).setItem(key, serialized);
      } catch {
        /* Session memory remains available. */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, fallback, storage],
  );
  return [value, setValue] as const;
}

// Visit times line up with ids by index; a visit without a time reads as 0. Kept in
// localStorage so visits from earlier days stay.
const recentDefault: { ids: number[]; times: number[] } = { ids: [], times: [] };
export interface DocumentVisit {
  id: number;
  at: number;
}
const visitsOf = ({ ids, times }: typeof recentDefault): DocumentVisit[] =>
  ids.map((id, index) => ({ id, at: times[index] ?? 0 }));
export function useRecentDocuments(projectKey: string | null) {
  const [recent, update] = useDocumentNavigation(projectKey, 'recent', recentDefault, 'local');
  const visit = useCallback(
    (id: number) =>
      update((previous) => {
        const visits = visitsOf(previous).filter((item) => item.id !== id);
        const next = [{ id, at: Date.now() }, ...visits].slice(0, 12);
        return { ids: next.map((item) => item.id), times: next.map((item) => item.at) };
      }),
    [update],
  );
  const visits = useMemo(() => visitsOf(recent).filter((item) => item.at > 0), [recent]);
  return { ids: recent.ids, visits, visit };
}
