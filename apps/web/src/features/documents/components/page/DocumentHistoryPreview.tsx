import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentRevision } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import DocumentMarkdownEditor from '../DocumentMarkdownEditor';

const noop = () => undefined;

export default function DocumentHistoryPreview({
  revision,
  version,
  canRestore,
  restoringRevisionId,
  restoreFailed,
  disabled,
  onRestore,
}: {
  revision: UseQueryResult<ProjectDocumentRevision>;
  version: number;
  canRestore: boolean;
  restoringRevisionId: number | null;
  restoreFailed: boolean;
  disabled: boolean;
  onRestore: (revisionId: number) => void;
}) {
  const t = useTranslations('documents');

  if (revision.isLoading) {
    return (
      <div className="space-y-3 p-6" aria-hidden>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  if (revision.isError) {
    return (
      <div className="grid min-h-72 place-items-center px-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground">{t('historyLoadFailed')}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            disabled={disabled}
            onClick={() => void revision.refetch()}
          >
            <RefreshCw />
            {t('reload')}
          </Button>
        </div>
      </div>
    );
  }
  const selected = revision.data;
  if (!selected) {
    return (
      <div className="grid min-h-72 place-items-center px-6 text-sm text-muted-foreground">
        {t('selectVersion')}
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-7">
      <header className="mb-6 flex items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {t('savedVersion', { version: selected.version })}
          </p>
          <h3 className="mt-1 truncate text-xl font-semibold" dir="auto">
            {selected.title.trim() || t('untitled')}
          </h3>
        </div>
        {canRestore && selected.version !== version && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onRestore(selected.id)}
          >
            {restoringRevisionId === selected.id ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
            {t('restoreVersion')}
          </Button>
        )}
      </header>
      {restoreFailed && (
        <p
          className="mb-5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t('saveFailed')}
        </p>
      )}
      <DocumentMarkdownEditor
        key={selected.id}
        defaultValue={selected.content}
        defaultJson={selected.contentJson}
        editable={false}
        placeholder=""
        className="text-sm leading-6"
        onReady={noop}
        onChange={noop}
        onBlur={noop}
      />
    </article>
  );
}
