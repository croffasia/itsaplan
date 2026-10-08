import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useColumnSearchContext } from '../../context/columnSearchContext';

export function ColumnSearchSummary({ id }: { id: string }) {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  const [announcement, setAnnouncement] = useState('');
  let count = '';
  if (search.loading) count = t('loading');
  else if (!search.denied && search.hasData) {
    count = search.matchQuery.trim()
      ? t('matches', { count: search.results.length, total: search.total })
      : t('count', { count: search.total });
  }
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(count), 250);
    return () => window.clearTimeout(timer);
  }, [count]);
  return (
    <>
      <div id={id} className="space-y-1 text-xs text-muted-foreground">
        <p className="tabular-nums">{count}</p>
        {search.project.project.subtasksEnabled && <p>{t('includesSubtasks')}</p>}
        {search.filtered && (
          <div className="flex flex-wrap items-center gap-x-2">
            <span>{t('filtersApplied')}</span>
            {search.viewFilters && (
              <button
                type="button"
                onClick={search.viewFilters}
                className="min-h-11 rounded-sm px-1 text-start underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('viewFilters')}
              </button>
            )}
          </div>
        )}
      </div>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
