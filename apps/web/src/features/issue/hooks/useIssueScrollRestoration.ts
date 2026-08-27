import {
  useLayoutEffect,
  useRef,
  type MouseEventHandler,
  type PointerEventHandler,
  type UIEventHandler,
} from 'react';

const SCROLL_SAVE_DELAY_MS = 100;

interface IssueScrollHistoryState {
  __itsaplanIssueScroll?: {
    pathname: string;
    scrollTop: number;
  };
}

function isIssueNavigation(target: EventTarget) {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  return link?.pathname.includes('/issue/') ?? false;
}

export function useIssueScrollRestoration(issuePathname: string | null) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIssuePathnameRef = useRef<string | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const clearPendingSave = () => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingScrollTopRef.current = null;
  };

  const saveScrollPosition = () => {
    const activeIssuePathname = activeIssuePathnameRef.current;
    const scrollTop = pendingScrollTopRef.current;
    if (activeIssuePathname == null || scrollTop == null) return;

    clearPendingSave();
    window.history.replaceState(
      {
        ...window.history.state,
        __itsaplanIssueScroll: { pathname: activeIssuePathname, scrollTop },
      },
      '',
    );
  };

  const saveCurrentScrollPosition = () => {
    if (!scrollRef.current) return;
    pendingScrollTopRef.current = scrollRef.current.scrollTop;
    saveScrollPosition();
  };

  useLayoutEffect(() => {
    if (issuePathname == null) {
      activeIssuePathnameRef.current = null;
      return;
    }

    const historyState = window.history.state as IssueScrollHistoryState | null;
    const savedPosition = historyState?.__itsaplanIssueScroll;
    const scrollTop = savedPosition?.pathname === issuePathname ? savedPosition.scrollTop : 0;
    activeIssuePathnameRef.current = issuePathname;

    const restore = () => {
      if (activeIssuePathnameRef.current === issuePathname && scrollRef.current) {
        scrollRef.current.scrollTop = scrollTop;
      }
    };

    restore();
    const frame = requestAnimationFrame(restore);
    return () => {
      cancelAnimationFrame(frame);
      clearPendingSave();
    };
  }, [issuePathname]);

  const onScroll: UIEventHandler<HTMLDivElement> = (event) => {
    pendingScrollTopRef.current = event.currentTarget.scrollTop;
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScrollPosition, SCROLL_SAVE_DELAY_MS);
  };

  const onPointerDownCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    if (isIssueNavigation(event.target)) saveCurrentScrollPosition();
  };

  const onClickCapture: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!isIssueNavigation(event.target)) return;
    if (event.detail === 0) {
      saveCurrentScrollPosition();
      return;
    }
    clearPendingSave();
  };

  return { scrollRef, onScroll, onClickCapture, onPointerDownCapture };
}
