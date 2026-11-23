'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Avatar from '@/components/common/Avatar';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { useShell } from '@/context/shellContext';
import { cn } from '@/lib/utils';
import { useDocumentRevisionsQuery } from '../../services/documents.service';
import DocumentDetailsSection from './DocumentDetailsSection';

const SHOWN = 4;

// The latest saved versions of the page. Each opens the Version history dialog.
export default function DocumentDetailsHistory({
  projectKey,
  documentId,
  version,
  onOpen,
}: {
  projectKey: string;
  documentId: number;
  version: number;
  onOpen: (revisionId?: number) => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { project } = useShell();
  const revisions = useDocumentRevisionsQuery(projectKey, documentId, true);
  const hint =
    'block w-full rounded-md p-4 text-center text-sm text-muted-foreground outline-1 -outline-offset-1 outline-input outline-dashed';

  return (
    <DocumentDetailsSection
      id="history"
      title={t('versionHistory')}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground"
          onClick={() => onOpen()}
        >
          {t('inspector.showAll')}
        </Button>
      }
    >
      {revisions.isLoading ? (
        <div className="space-y-1" aria-hidden>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : revisions.isError ? (
        <button
          type="button"
          className={cn(hint, 'text-destructive outline-destructive/40')}
          onClick={() => void revisions.refetch()}
        >
          {t('historyLoadFailed')}
        </button>
      ) : revisions.data?.length ? (
        <ol>
          {revisions.data.slice(0, SHOWN).map((revision) => {
            const author = project?.assignees.find(
              (assignee) => assignee.userId === revision.createdByUserId,
            );
            const name = author?.name ?? t('unknownAuthor');
            return (
              <li key={revision.id}>
                <button
                  type="button"
                  className="-mx-2 flex h-9 w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 text-start text-[13px] transition-colors hover:bg-accent"
                  onClick={() => onOpen(revision.id)}
                >
                  <Avatar name={name} image={author?.image ?? null} />
                  <span className="min-w-0 flex-1 truncate">
                    <span dir="auto">{name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {relativeTime(revision.createdAt)}
                    </span>
                  </span>
                  {revision.version === version ? (
                    <span className="rounded-full bg-secondary px-1.5 py-px text-[11px] font-medium">
                      {t('inspector.current')}
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-medium text-muted-foreground" dir="ltr">
                      v{revision.version}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={hint}>{t('noHistory')}</p>
      )}
    </DocumentDetailsSection>
  );
}
