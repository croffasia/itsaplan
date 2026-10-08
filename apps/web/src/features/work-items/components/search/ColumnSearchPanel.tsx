import { useLayoutEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useColumnSearchContext } from '../../context/columnSearchContext';
import { ColumnSearchControl } from './ColumnSearchControl';
import { ColumnSearchContent } from './ColumnSearchContent';

export function ColumnSearchPanel({ className }: { className?: string }) {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  const focusedColumn = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (search.externalOverlayOpen) return;
    if (search.returnToResult.current) {
      if (!search.loading && search.resultsRef.current && search.draft.focusedId != null) {
        search.resultsRef.current.focusIssue(search.draft.focusedId);
        search.returnToResult.current = false;
      } else {
        search.inputRef.current?.focus({ preventScroll: true });
        if (!search.loading) search.returnToResult.current = false;
      }
    } else if (focusedColumn.current !== search.active?.key) {
      search.inputRef.current?.focus({ preventScroll: true });
    }
    focusedColumn.current = search.active?.key ?? null;
  }, [
    search.active?.key,
    search.loading,
    search.externalOverlayOpen,
    search.inputRef,
    search.resultsRef,
    search.returnToResult,
    search.draft,
  ]);
  return (
    <section
      aria-label={t('scope', { column: search.group?.name ?? '' })}
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) {
          event.stopPropagation();
          return;
        }
        if (
          event.key === 'Escape' &&
          search.active?.mode === 'inline' &&
          !search.externalOverlayOpen
        ) {
          event.preventDefault();
          event.stopPropagation();
          search.close();
        }
      }}
    >
      <ColumnSearchControl />
      <ColumnSearchContent />
    </section>
  );
}
