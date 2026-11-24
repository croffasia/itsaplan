import type { UseQueryResult } from '@tanstack/react-query';
import { Check, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentRevisionSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { cn } from '@/lib/utils';

export default function DocumentHistoryList({
  revisions,
  version,
  selectedId,
  authorNames,
  disabled,
  onSelect,
}: {
  revisions: UseQueryResult<ProjectDocumentRevisionSummary[]>;
  version: number;
  selectedId: number | null;
  authorNames: Record<string, string>;
  disabled: boolean;
  onSelect: (revisionId: number) => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();

  if (revisions.isLoading) {
    return (
      <div className="space-y-1.5 p-1" aria-hidden>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (revisions.isError) {
    return (
      <div className="grid min-h-48 place-items-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">{t('historyLoadFailed')}</p>
          <Button
            type="button"
            className="mt-3"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => void revisions.refetch()}
          >
            <RefreshCw />
            {t('reload')}
          </Button>
        </div>
      </div>
    );
  }
  if (!revisions.data?.length) {
    return (
      <div className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted-foreground">
        {t('noHistory')}
      </div>
    );
  }

  return (
    <ol aria-label={t('versionHistory')}>
      {revisions.data.map((revision) => {
        const current = revision.version === version;
        const selected = selectedId === revision.id;
        const author = revision.createdByUserId
          ? (authorNames[revision.createdByUserId] ?? t('unknownAuthor'))
          : t('unknownAuthor');

        return (
          <li key={revision.id}>
            <button
              type="button"
              className={cn(
                'group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-start transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                selected && 'bg-accent text-accent-foreground',
              )}
              aria-current={selected ? 'true' : undefined}
              disabled={disabled}
              onClick={() => onSelect(revision.id)}
            >
              <span
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full border border-muted-foreground/40',
                  selected && 'border-primary bg-primary',
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {current
                      ? t('currentVersion', { version: revision.version })
                      : t('savedVersion', { version: revision.version })}
                  </span>
                  {current && <Check className="size-3.5 text-primary" aria-hidden />}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground" dir="auto">
                  {revision.title.trim() || t('untitled')}
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                  {t('versionBy', {
                    name: author,
                    time: relativeTime(revision.createdAt),
                  })}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
