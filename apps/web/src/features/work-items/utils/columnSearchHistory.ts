export interface ColumnSearchDraft {
  query: string;
  scrollTop: number;
  focusedId?: number;
  focusedIndex?: number;
  anchorId?: number;
  anchorOffset?: number;
}

export interface ColumnSearchSnapshot {
  activeKey: string | null;
  mode: 'inline' | 'modal';
  drafts: Record<string, ColumnSearchDraft>;
  board: { left: number; top: number };
  columns: Record<string, number>;
}

interface SearchHistoryEntry {
  owner: string;
  scope: string;
  pathname: string;
  documentId: number;
  snapshot?: ColumnSearchSnapshot;
}

const HISTORY_KEY = '__itsaplanColumnSearch';

export function readColumnSearchHistory(
  state: Record<string, unknown> | null,
  scope: string,
  pathname: string,
  documentId: number,
): SearchHistoryEntry | null {
  const entry = state?.[HISTORY_KEY] as SearchHistoryEntry | undefined;
  return entry?.scope === scope &&
    entry.pathname === pathname &&
    entry.documentId === documentId &&
    typeof entry.owner === 'string'
    ? entry
    : null;
}

export function columnSearchHistoryState(
  state: Record<string, unknown> | null,
  entry: SearchHistoryEntry,
  expectedOwner?: string,
): Record<string, unknown> | null {
  if (
    expectedOwner &&
    (state?.[HISTORY_KEY] as SearchHistoryEntry | undefined)?.owner !== expectedOwner
  )
    return null;
  return { ...state, [HISTORY_KEY]: entry };
}
