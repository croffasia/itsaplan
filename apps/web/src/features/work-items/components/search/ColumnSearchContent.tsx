import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useColumnSearchContext } from '../../context/columnSearchContext';
import { ColumnSearchResults } from './ColumnSearchResults';

export function ColumnSearchContent() {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  if (search.denied)
    return (
      <p role="alert" className="p-3 text-sm">
        {t('accessDenied')}
      </p>
    );
  if (search.loading)
    return (
      <div aria-busy="true" className="space-y-2 px-1">
        <p className="sr-only">{t('loading')}</p>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-24 rounded-md" />
        ))}
      </div>
    );
  return (
    <>
      {search.error != null && (
        <div role="status" className="mb-2 rounded-md bg-muted p-3 text-sm">
          <p>{search.hasData ? t('outdated') : t('loadFailed')}</p>
          <Button variant="ghost" className="min-h-11" onClick={search.retry}>
            {t('retry')}
          </Button>
        </div>
      )}
      {search.results.length > 0 && <ColumnSearchResults />}
      {search.results.length === 0 && !search.error && (
        <div className="space-y-2 p-3 text-sm">
          <p dir="auto" className="break-words">
            {search.matchQuery.trim()
              ? t('noMatches', { query: search.query, column: search.group?.name ?? '' })
              : t('empty')}
          </p>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              if (search.query.trim()) {
                search.changeQuery('');
                search.inputRef.current?.focus();
              } else search.close();
            }}
          >
            {search.query.trim() ? t('clear') : t('close')}
          </Button>
        </div>
      )}
    </>
  );
}
