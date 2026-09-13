import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  columnSearchHistoryState,
  readColumnSearchHistory,
  type ColumnSearchDraft,
  type ColumnSearchSnapshot,
} from '../utils/columnSearchHistory';

const emptyDraft = (): ColumnSearchDraft => ({ query: '', scrollTop: 0 });

export function useColumnSearchState(scope: string, pathname: string) {
  const [active, setActive] = useState<{ key: string; mode: 'inline' | 'modal' } | null>(null);
  const [query, setQuery] = useState('');
  const [matchQuery, setMatchQuery] = useState('');
  const drafts = useRef<Record<string, ColumnSearchDraft>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const entryRefs = useRef(new Map<string, HTMLButtonElement>());
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<{
    focusIndex: (index: number) => void;
    focusIssue: (id: number) => void;
  } | null>(null);
  const returnToResult = useRef(false);
  const composing = useRef(false);
  const positions = useRef({ board: { left: 0, top: 0 }, columns: {} as Record<string, number> });
  const historyEntry = useRef<NonNullable<ReturnType<typeof readColumnSearchHistory>> | null>(null);

  useLayoutEffect(() => {
    setActive(null);
    setQuery('');
    setMatchQuery('');
    drafts.current = {};
    const saved = readColumnSearchHistory(
      window.history.state,
      scope,
      pathname,
      performance.timeOrigin,
    );
    const entry = {
      ...saved,
      owner: crypto.randomUUID(),
      scope,
      pathname,
      documentId: performance.timeOrigin,
    };
    historyEntry.current = entry;
    window.history.replaceState(columnSearchHistoryState(window.history.state, entry), '');
    const snapshot = entry.snapshot;
    if (snapshot) {
      drafts.current = snapshot.drafts;
      positions.current = { board: snapshot.board, columns: snapshot.columns };
      if (snapshot.activeKey) {
        setActive({ key: snapshot.activeKey, mode: snapshot.mode });
        const restoredQuery = snapshot.drafts[snapshot.activeKey]?.query ?? '';
        setQuery(restoredQuery);
        setMatchQuery(restoredQuery);
        returnToResult.current = true;
      }
      if (boardRef.current) {
        boardRef.current.scrollLeft = snapshot.board.left;
        boardRef.current.scrollTop = snapshot.board.top;
      }
      for (const [key, el] of columnRefs.current) el.scrollTop = snapshot.columns[key] ?? 0;
    }
  }, [scope, pathname]);

  const draft = active ? (drafts.current[active.key] ??= emptyDraft()) : emptyDraft();
  const rememberPositions = useCallback(() => {
    if (boardRef.current)
      positions.current.board = {
        left: boardRef.current.scrollLeft,
        top: boardRef.current.scrollTop,
      };
    for (const [key, el] of columnRefs.current) {
      if (!el.hidden) positions.current.columns[key] = el.scrollTop;
    }
  }, []);

  const restorePositions = useCallback((key?: string, restoreBoard = true) => {
    requestAnimationFrame(() => {
      if (restoreBoard && boardRef.current) {
        boardRef.current.scrollLeft = positions.current.board.left;
        boardRef.current.scrollTop = positions.current.board.top;
      }
      if (key) {
        const element = columnRefs.current.get(key);
        if (element) element.scrollTop = positions.current.columns[key] ?? element.scrollTop;
      }
    });
  }, []);

  const close = useCallback(
    (focus = true) => {
      const key = active?.key;
      setActive(null);
      restorePositions(key);
      if (focus && key)
        requestAnimationFrame(() => entryRefs.current.get(key)?.focus({ preventScroll: true }));
      const entry = historyEntry.current;
      if (entry && window.location.pathname === pathname) {
        const next = columnSearchHistoryState(
          window.history.state,
          { ...entry, snapshot: undefined },
          entry.owner,
        );
        if (next) window.history.replaceState(next, '');
      }
    },
    [active?.key, pathname, restorePositions],
  );

  const open = (key: string) => {
    if (active) restorePositions(active.key, false);
    rememberPositions();
    const next = (drafts.current[key] ??= emptyDraft());
    returnToResult.current = false;
    setQuery(next.query);
    setMatchQuery(next.query);
    setActive({
      key,
      mode: window.matchMedia('(min-width: 768px) and (pointer: fine)').matches
        ? 'inline'
        : 'modal',
    });
  };

  const changeQuery = (value: string, commit = true) => {
    if (!active) return;
    drafts.current[active.key].query = value;
    setQuery(value);
    if (commit) {
      if (value !== matchQuery) {
        drafts.current[active.key].scrollTop = 0;
        drafts.current[active.key].anchorId = undefined;
        drafts.current[active.key].focusedId = undefined;
      }
      setMatchQuery(value);
    }
  };

  const capture = () => {
    const entry = historyEntry.current;
    if (!entry || window.location.pathname !== pathname) return;
    for (const [key, element] of columnRefs.current) {
      if (!element.hidden) positions.current.columns[key] = element.scrollTop;
    }
    const snapshot: ColumnSearchSnapshot = {
      activeKey: active?.key ?? null,
      mode: active?.mode ?? 'inline',
      drafts: structuredClone(drafts.current),
      ...positions.current,
    };
    if (boardRef.current)
      snapshot.board = { left: boardRef.current.scrollLeft, top: boardRef.current.scrollTop };
    const next = columnSearchHistoryState(
      window.history.state,
      { ...entry, snapshot },
      entry.owner,
    );
    if (next) window.history.replaceState(next, '');
  };

  return {
    active,
    query,
    matchQuery,
    draft,
    open,
    close,
    changeQuery,
    capture,
    boardRef,
    columnRefs,
    entryRefs,
    inputRef,
    resultsRef,
    returnToResult,
    composing,
  };
}
