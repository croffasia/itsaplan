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
const SCROLL_ANCHOR_ATTRIBUTE = 'data-history-scroll-restoration-anchor';
const scrollContainerStyle = { overflowAnchor: 'none' } satisfies CSSProperties;
const scrollPositions = new Map<string, number>();
let nextHistoryEntryId = 0;

export const historyScrollRestorationLinkProps = { scroll: false } as const;

export function historyScrollRestorationAnchorProps(key: string) {
  return { [SCROLL_ANCHOR_ATTRIBUTE]: key };
}

interface ScrollRestorationAnchor {
  key: string;
  offsetTop: number;
}

interface ScrollRestorationPosition {
  entryId: string;
  pathname: string;
  scrollTop: number;
  anchor?: ScrollRestorationAnchor;
}

interface ScrollRestorationHistoryState {
  __itsaplanScrollRestoration?: ScrollRestorationPosition;
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

function findAnchorElement(container: HTMLElement, key: string) {
  return Array.from(container.querySelectorAll<HTMLElement>(`[${SCROLL_ANCHOR_ATTRIBUTE}]`)).find(
    (element) => element.getAttribute(SCROLL_ANCHOR_ATTRIBUTE) === key,
  );
}

function captureAnchor(container: HTMLElement, target: EventTarget | null) {
  if (!(target instanceof Element)) return undefined;
  const element = target.closest(`[${SCROLL_ANCHOR_ATTRIBUTE}]`);
  if (!(element instanceof HTMLElement) || !container.contains(element)) return undefined;
  const key = element.getAttribute(SCROLL_ANCHOR_ATTRIBUTE);
  if (!key) return undefined;
  return {
    key,
    offsetTop: element.getBoundingClientRect().top - container.getBoundingClientRect().top,
  };
}

function validAnchor(value: unknown): value is ScrollRestorationAnchor {
  if (!value || typeof value !== 'object') return false;
  const anchor = value as Partial<ScrollRestorationAnchor>;
  return (
    typeof anchor.key === 'string' &&
    anchor.key.length > 0 &&
    typeof anchor.offsetTop === 'number' &&
    Number.isFinite(anchor.offsetTop)
  );
}

function replaceHistoryPosition(position: ScrollRestorationPosition) {
  window.history.replaceState(
    { ...window.history.state, __itsaplanScrollRestoration: position },
    '',
  );
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
  const pendingAnchorRef = useRef<ScrollRestorationAnchor | undefined>(undefined);
  const saveTimerRef = useRef<number | null>(null);

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingScrollTopRef.current = null;
    pendingAnchorRef.current = undefined;
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
    const anchor = pendingAnchorRef.current;
    if (activeEntryId == null || activePathname == null || scrollTop == null) return;

    scrollPositions.set(activeEntryId, scrollTop);
    const historyState = window.history.state as ScrollRestorationHistoryState | null;
    const historyPosition = historyState?.__itsaplanScrollRestoration;
    if (window.location.pathname !== activePathname || historyPosition?.entryId !== activeEntryId) {
      clearPendingSave();
      return;
    }

    clearPendingSave();
    replaceHistoryPosition({
      entryId: activeEntryId,
      pathname: activePathname,
      scrollTop,
      ...(anchor ? { anchor } : {}),
    });
  }, [clearPendingSave]);

  const saveCurrentScrollPosition = useCallback(
    (target?: EventTarget | null) => {
      if (!scrollRef.current) return;
      stopRestoration();
      pendingScrollTopRef.current = scrollRef.current.scrollTop;
      pendingAnchorRef.current = captureAnchor(scrollRef.current, target ?? null);
      saveScrollPosition();
    },
    [saveScrollPosition, stopRestoration],
  );

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
    const anchor =
      ownsHistoryEntry && validAnchor(savedPosition.anchor) ? savedPosition.anchor : undefined;

    activeEntryIdRef.current = entryId;
    activePathnameRef.current = pathname;
    isRestoringRef.current = true;
    scrollPositions.set(entryId, scrollTop);
    replaceHistoryPosition({
      entryId,
      pathname,
      scrollTop,
      ...(anchor ? { anchor } : {}),
    });

    let absoluteScrollRestored = false;
    let anchorWasFound = false;
    const restore = () => {
      if (
        isRestoringRef.current &&
        activeEntryIdRef.current === entryId &&
        activePathnameRef.current === pathname &&
        scrollRef.current
      ) {
        const container = scrollRef.current;
        const anchorElement = anchor ? findAnchorElement(container, anchor.key) : undefined;
        if (anchor && anchorElement) {
          anchorWasFound = true;
          const currentOffset =
            anchorElement.getBoundingClientRect().top - container.getBoundingClientRect().top;
          container.scrollTop += currentOffset - anchor.offsetTop;
          restoredScrollTopRef.current = container.scrollTop;
          scrollPositions.set(entryId, container.scrollTop);
          const currentState = window.history.state as ScrollRestorationHistoryState | null;
          if (
            window.location.pathname === pathname &&
            currentState?.__itsaplanScrollRestoration?.entryId === entryId
          ) {
            replaceHistoryPosition({
              entryId,
              pathname,
              scrollTop: container.scrollTop,
              anchor,
            });
          }
        } else if (anchorWasFound) {
          stopRestoration();
        } else if (!absoluteScrollRestored) {
          container.scrollTop = scrollTop;
          restoredScrollTopRef.current = container.scrollTop;
          if (Math.abs(container.scrollTop - scrollTop) < 1) {
            absoluteScrollRestored = true;
            if (!anchor) stopRestoration();
          }
        }
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
    pendingAnchorRef.current = undefined;
    const activeEntryId = activeEntryIdRef.current;
    if (activeEntryId != null) scrollPositions.set(activeEntryId, scrollTop);
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScrollPosition, SCROLL_SAVE_DELAY_MS);
  };

  const onPointerDownCapture: PointerEventHandler<T> = (event) =>
    saveCurrentScrollPosition(event.target);
  const onClickCapture: MouseEventHandler<T> = (event) => saveCurrentScrollPosition(event.target);

  return {
    ref: scrollRef,
    style: scrollContainerStyle,
    onScroll,
    onClickCapture,
    onPointerDownCapture,
  };
}
