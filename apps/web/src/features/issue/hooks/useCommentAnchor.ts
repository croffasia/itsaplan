import { useEffect, useState } from 'react';
import { useFeedQuery, useGroupedFeedQuery } from '../services/comments.service';
import type { ActivityFeedView } from './useActivityFeedView';
import { markCommentAnchored } from './useCommentHash';

// How long the comment is kept in place after the jump while the content above it still
// loads, and how long it stays highlighted.
const SETTLE_MS = 3000;
const HIGHLIGHT_MS = 2000;
// The reader scrolling, touching, typing or clicking: from then on they move on their own.
const READER_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

// Brings the comment a link or a notification points at into view, and returns its id
// while it is highlighted. The feed renders 25 entries a page, so the hook loads pages
// through the list's own cache until the comment's element exists. It stops when the
// feed ends without it (the comment is deleted, or the id is not a comment's), when a
// page fails, or when the reader starts moving first.
export function useCommentAnchor(
  issueId: number,
  view: ActivityFeedView,
  commentId: number | null,
): number | null {
  const request = commentId == null ? null : `${issueId}:${commentId}`;
  const [prevRequest, setPrevRequest] = useState(request);
  const [searching, setSearching] = useState(request != null);
  const [tabSwitched, setTabSwitched] = useState(false);
  const [landedId, setLandedId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  if (request !== prevRequest) {
    setPrevRequest(request);
    setSearching(request != null);
    setTabSwitched(false);
    setLandedId(null);
    setHighlightedId(null);
  }

  const flatFeed = useFeedQuery(issueId, view.slice, false);
  const groupedFeed = useGroupedFeedQuery(issueId, view.slice, false);
  const { data, isPending, isFetching, hasNextPage, isFetchNextPageError, fetchNextPage } =
    view.grouped ? groupedFeed : flatFeed;
  const { ready, tab, showAll } = view;

  // `data` is a dependency because the comment is looked for in the DOM rendered from it.
  useEffect(() => {
    if (!searching || commentId == null || !ready) return;
    const finish = () => {
      setSearching(false);
      markCommentAnchored(commentId);
    };
    if (tab !== 'all' && tab !== 'comments') {
      // After the one switch, a tab without comments is one the reader picked.
      if (tabSwitched) {
        finish();
      } else {
        setTabSwitched(true);
        showAll();
      }
      return;
    }
    if (document.getElementById(`feed-item-${commentId}`)) {
      setSearching(false);
      setLandedId(commentId);
      return;
    }
    // Pending means no page has arrived yet, also in the commit where the list only
    // starts the fetch.
    if (isPending || isFetching) return;
    if (hasNextPage && !isFetchNextPageError) {
      // Joins a live-refresh refetch in flight instead of cancelling it.
      void fetchNextPage({ cancelRefetch: false });
    } else {
      finish();
    }
  }, [
    searching,
    commentId,
    ready,
    tab,
    tabSwitched,
    showAll,
    data,
    isPending,
    isFetching,
    hasNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);

  useEffect(() => {
    if (!searching || commentId == null) return;
    const stop = () => {
      setSearching(false);
      markCommentAnchored(commentId);
    };
    for (const type of READER_EVENTS)
      window.addEventListener(type, stop, { capture: true, passive: true });
    return () => {
      for (const type of READER_EVENTS) window.removeEventListener(type, stop, true);
    };
  }, [searching, commentId]);

  useEffect(() => {
    if (landedId == null) return;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      observer?.disconnect();
      clearTimeout(timer);
      for (const type of READER_EVENTS) window.removeEventListener(type, release, true);
    };
    // A comment's body renders a tick after its element, so the jump waits a frame.
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`feed-item-${landedId}`);
      if (!el) return;
      const scroller = scrollParent(el);
      const align = () =>
        el.scrollIntoView({
          block: scroller && el.offsetHeight > scroller.clientHeight / 2 ? 'start' : 'center',
        });
      align();
      setHighlightedId(landedId);
      markCommentAnchored(landedId);
      // The sections above the feed and the images load later and push the comment
      // down, and the page scroller has scroll anchoring off, so every resize aligns
      // it again.
      const content = scroller?.firstElementChild;
      if (content) {
        observer = new ResizeObserver(align);
        observer.observe(content);
      }
      timer = setTimeout(release, SETTLE_MS);
      for (const type of READER_EVENTS)
        window.addEventListener(type, release, { capture: true, passive: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      release();
    };
  }, [landedId]);

  useEffect(() => {
    if (highlightedId == null) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  return highlightedId;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}
