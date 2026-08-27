import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
  type UIEventHandler,
} from 'react';

const SCROLL_SAVE_DELAY_MS = 100;
const scrollContainerStyle = { overflowAnchor: 'none' } satisfies CSSProperties;
const scrollPositions = new Map<string, number>();
let nextHistoryEntryId = 0;

export const historyScrollRestorationLinkProps = { scroll: false } as const;

interface ScrollRestorationHistoryState {
  __itsaplanScrollRestoration?: {
    entryId: string;
    pathname: string;
    scrollTop: number;
  };
}

interface HistoryScrollRestorationOptions {
  pathname: string | null;
}

interface ScrollRestorationProps<T extends HTMLElement> {
  ref: RefObject<T | null>;
  style: CSSProperties;
  onScroll: UIEventHandler<T>;
  onClickCapture: MouseEventHandler<T>;
  onPointerDownCapture: PointerEventHandler<T>;
}

export function useHistoryScrollRestoration<T extends HTMLElement = HTMLDivElement>({
  pathname,
}: HistoryScrollRestorationOptions): ScrollRestorationProps<T> {
  const scrollRef = useRef<T>(null);
  const activeEntryIdRef = useRef<string | null>(null);
  const activePathnameRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  const restoredScrollTopRef = useRef<number | null>(null);
  const restoreObserverRef = useRef<ResizeObserver | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingScrollTopRef.current = null;
  }, []);

  const stopRestoration = useCallback(() => {
    restoreObserverRef.current?.disconnect();
    restoreObserverRef.current = null;
    isRestoringRef.current = false;
    restoredScrollTopRef.current = null;
  }, []);

  const saveScrollPosition = useCallback(() => {
    const activeEntryId = activeEntryIdRef.current;
    const activePathname = activePathnameRef.current;
    const scrollTop = pendingScrollTopRef.current;
    if (activeEntryId == null || activePathname == null || scrollTop == null) return;

    scrollPositions.set(activeEntryId, scrollTop);
    const historyState = window.history.state as ScrollRestorationHistoryState | null;
    const historyPosition = historyState?.__itsaplanScrollRestoration;
    if (window.location.pathname !== activePathname || historyPosition?.entryId !== activeEntryId) {
      clearPendingSave();
      return;
    }

    clearPendingSave();
    window.history.replaceState(
      {
        ...window.history.state,
        __itsaplanScrollRestoration: {
          entryId: activeEntryId,
          pathname: activePathname,
          scrollTop,
        },
      },
      '',
    );
  }, [clearPendingSave]);

  const saveCurrentScrollPosition = useCallback(() => {
    if (!scrollRef.current) return;
    stopRestoration();
    pendingScrollTopRef.current = scrollRef.current.scrollTop;
    saveScrollPosition();
  }, [saveScrollPosition, stopRestoration]);

  useLayoutEffect(() => {
    stopRestoration();
    if (pathname == null) {
      activeEntryIdRef.current = null;
      activePathnameRef.current = null;
      return;
    }

    const historyState = window.history.state as ScrollRestorationHistoryState | null;
    const savedPosition = historyState?.__itsaplanScrollRestoration;
    const ownsHistoryEntry =
      savedPosition?.pathname === pathname &&
      typeof savedPosition.entryId === 'string' &&
      savedPosition.entryId.length > 0 &&
      Number.isFinite(savedPosition.scrollTop);
    const entryId = ownsHistoryEntry
      ? savedPosition.entryId
      : `${performance.timeOrigin}:${++nextHistoryEntryId}`;
    const persistedScrollTop = ownsHistoryEntry ? savedPosition.scrollTop : 0;
    const scrollTop = scrollPositions.get(entryId) ?? persistedScrollTop;

    activeEntryIdRef.current = entryId;
    activePathnameRef.current = pathname;
    isRestoringRef.current = true;
    scrollPositions.set(entryId, scrollTop);
    window.history.replaceState(
      {
        ...window.history.state,
        __itsaplanScrollRestoration: { entryId, pathname, scrollTop },
      },
      '',
    );

    const restore = () => {
      if (
        isRestoringRef.current &&
        activeEntryIdRef.current === entryId &&
        activePathnameRef.current === pathname &&
        scrollRef.current
      ) {
        scrollRef.current.scrollTop = scrollTop;
        restoredScrollTopRef.current = scrollRef.current.scrollTop;
        if (Math.abs(scrollRef.current.scrollTop - scrollTop) < 1) stopRestoration();
      }
    };

    const content = scrollRef.current?.firstElementChild;
    if (content && typeof ResizeObserver !== 'undefined') {
      restoreObserverRef.current = new ResizeObserver(restore);
      restoreObserverRef.current.observe(content);
    }
    restore();
    const frame = requestAnimationFrame(restore);

    const persistBeforePageHide = () => {
      if (!isRestoringRef.current) saveCurrentScrollPosition();
    };
    window.addEventListener('pagehide', persistBeforePageHide);
    return () => {
      window.removeEventListener('pagehide', persistBeforePageHide);
      cancelAnimationFrame(frame);
      stopRestoration();
      clearPendingSave();
    };
  }, [clearPendingSave, pathname, saveCurrentScrollPosition, stopRestoration]);

  const onScroll: UIEventHandler<T> = (event) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (isRestoringRef.current) {
      if (restoredScrollTopRef.current === scrollTop) return;
      stopRestoration();
    }

    pendingScrollTopRef.current = scrollTop;
    const activeEntryId = activeEntryIdRef.current;
    if (activeEntryId != null) scrollPositions.set(activeEntryId, scrollTop);
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScrollPosition, SCROLL_SAVE_DELAY_MS);
  };

  const onPointerDownCapture: PointerEventHandler<T> = saveCurrentScrollPosition;
  const onClickCapture: MouseEventHandler<T> = (event) => {
    if (event.detail === 0) saveCurrentScrollPosition();
  };

  return {
    ref: scrollRef,
    style: scrollContainerStyle,
    onScroll,
    onClickCapture,
    onPointerDownCapture,
  };
}
