import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { useColumnSearchContext } from '../../context/columnSearchContext';
import { ColumnSearchResult } from './ColumnSearchResult';

export function ColumnSearchResults() {
  const search = useColumnSearchContext();
  const { results, draft } = search;
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusWithin = useRef(false);
  const [focusedId, setFocusedId] = useState(draft.focusedId ?? results[0]?.issue.id);
  const previousFocusedIndex = useRef(draft.focusedIndex ?? 0);
  const foundIndex = results.findIndex((result) => result.issue.id === focusedId);
  const focusedIndex =
    foundIndex >= 0
      ? foundIndex
      : Math.max(0, Math.min(previousFocusedIndex.current, results.length - 1));
  previousFocusedIndex.current = focusedIndex;
  const virtualizer = useVirtualizer({
    useFlushSync: false,
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 128,
    getItemKey: (index) => results[index].issue.id,
    initialOffset: draft.scrollTop,
    overscan: 5,
    rangeExtractor: useCallback(
      (range) =>
        [...new Set([...defaultRangeExtractor(range), focusedIndex])].sort((a, b) => a - b),
      [focusedIndex],
    ),
  });
  const focusIndex = useCallback(
    (index: number) => {
      const next = results[Math.max(0, Math.min(index, results.length - 1))];
      if (!next) {
        search.inputRef.current?.focus();
        return;
      }
      setFocusedId(next.issue.id);
      draft.focusedId = next.issue.id;
      draft.focusedIndex = results.indexOf(next);
      virtualizer.scrollToIndex(results.indexOf(next), { align: 'auto' });
      requestAnimationFrame(() =>
        scrollRef.current
          ?.querySelector<HTMLAnchorElement>(`[data-search-task="${next.issue.id}"]`)
          ?.focus({ preventScroll: true }),
      );
    },
    [results, draft, virtualizer, search.inputRef],
  );
  useLayoutEffect(() => {
    search.resultsRef.current = {
      focusIndex,
      focusIssue: (id) => {
        const index = results.findIndex((result) => result.issue.id === id);
        focusIndex(index >= 0 ? index : (draft.focusedIndex ?? 0));
      },
    };
    return () => {
      search.resultsRef.current = null;
    };
  }, [search.resultsRef, focusIndex, results, draft]);
  useLayoutEffect(
    () => () => {
      if (focusWithin.current) search.returnToResult.current = true;
    },
    [search.returnToResult],
  );

  const resetKey = `${search.matchQuery}\u0000${search.filterKey}`;
  const previousResetKey = useRef(resetKey);
  useLayoutEffect(() => {
    if (resetKey !== previousResetKey.current) {
      draft.scrollTop = 0;
      draft.anchorId = undefined;
      draft.focusedId = results[0]?.issue.id;
      setFocusedId(draft.focusedId);
      virtualizer.scrollToOffset(0);
      previousResetKey.current = resetKey;
    } else if (draft.anchorId != null) {
      const anchorIndex = results.findIndex((result) => result.issue.id === draft.anchorId);
      if (anchorIndex >= 0) {
        const offset = virtualizer.getOffsetForIndex(anchorIndex, 'start')?.[0];
        if (offset != null)
          virtualizer.scrollToOffset(Math.max(0, offset + (draft.anchorOffset ?? 0)));
      }
    }
  }, [results, resetKey, draft, virtualizer]);
  useLayoutEffect(() => {
    if (focusedId != null && !results.some((result) => result.issue.id === focusedId)) {
      const listHasFocus = focusWithin.current;
      setFocusedId(results[focusedIndex]?.issue.id);
      if (listHasFocus) focusIndex(focusedIndex);
    }
  }, [results, focusedId, focusedIndex, focusIndex]);

  return (
    <div
      ref={scrollRef}
      data-column-search-results
      className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-1 pb-2"
      onFocusCapture={() => {
        focusWithin.current = true;
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          focusWithin.current = false;
      }}
      onScroll={() => {
        const top = scrollRef.current?.scrollTop ?? 0;
        draft.scrollTop = top;
        const first = virtualizer.getVirtualItems().find((item) => item.end > top);
        if (first) {
          draft.anchorId = results[first.index]?.issue.id;
          draft.anchorOffset = top - first.start;
        }
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        const moves: Record<string, number> = {
          ArrowDown: focusedIndex + 1,
          ArrowUp: focusedIndex - 1,
          Home: 0,
          End: results.length - 1,
        };
        if (event.key in moves) {
          event.preventDefault();
          event.stopPropagation();
          focusIndex(moves[event.key]);
        }
      }}
    >
      <ul
        aria-label={search.group?.name}
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const result = results[item.index];
          return (
            <li
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              aria-posinset={item.index + 1}
              aria-setsize={results.length}
              className="absolute start-0 top-0 w-full pb-2"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <ColumnSearchResult
                result={result}
                tabIndex={item.index === focusedIndex ? 0 : -1}
                onFocus={() => {
                  setFocusedId(result.issue.id);
                  draft.focusedId = result.issue.id;
                  draft.focusedIndex = item.index;
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
