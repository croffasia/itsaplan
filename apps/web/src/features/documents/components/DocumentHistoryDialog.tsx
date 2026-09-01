'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, History, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { api, type ProjectDocument } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  useDocumentRevisionsQuery,
  useRestoreDocumentRevision,
} from '../services/documents.service';
import DocumentMarkdownEditor from './DocumentMarkdownEditor';

const noop = () => undefined;

export default function DocumentHistoryDialog({
  open,
  projectKey,
  documentId,
  version,
  authorNames,
  canRestore,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  projectKey: string;
  documentId: number;
  version: number;
  authorNames: Record<string, string>;
  canRestore: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (document: ProjectDocument) => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const revisions = useDocumentRevisionsQuery(projectKey, documentId, open);
  const restore = useRestoreDocumentRevision(projectKey);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<number | null>(null);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const mountedRef = useRef(false);
  const openRef = useRef(open);
  const restoreLockRef = useRef(false);
  const restoreAttemptRef = useRef(0);
  openRef.current = open;

  const canInteract = canInteractWithDocumentHistory(restoringRevisionId);
  const selectedRevision = useQuery({
    queryKey: ['documents', projectKey, 'document', documentId, 'revision', selectedRevisionId],
    queryFn: () => api.getDocumentRevision(projectKey, documentId, selectedRevisionId!),
    enabled: open && selectedRevisionId !== null,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      restoreAttemptRef.current += 1;
    };
  }, []);

  useEffect(() => {
    restoreAttemptRef.current += 1;
    setSelectedRevisionId(null);
    setRestoreFailed(false);
  }, [documentId]);

  useEffect(() => {
    if (!open) {
      restoreAttemptRef.current += 1;
      setSelectedRevisionId(null);
      setRestoreFailed(false);
      return;
    }

    const selectionExists = revisions.data?.some((item) => item.id === selectedRevisionId);
    if (!selectionExists) setSelectedRevisionId(revisions.data?.[0]?.id ?? null);
  }, [open, revisions.data, selectedRevisionId]);

  const restoreRevision = async (revisionId: number) => {
    if (restoreLockRef.current) return;
    restoreLockRef.current = true;
    const attempt = ++restoreAttemptRef.current;
    setRestoringRevisionId(revisionId);
    setRestoreFailed(false);

    try {
      const updated = await restore.mutateAsync({ documentId, revisionId, version });
      if (
        canApplyDocumentHistoryRestore({
          attempt,
          currentAttempt: restoreAttemptRef.current,
          open: openRef.current,
          mounted: mountedRef.current,
        })
      ) {
        onRestored(updated);
        onOpenChange(false);
      }
    } catch {
      if (mountedRef.current && openRef.current && attempt === restoreAttemptRef.current) {
        setRestoreFailed(true);
      }
    } finally {
      restoreLockRef.current = false;
      if (mountedRef.current) setRestoringRevisionId(null);
    }
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && !canInteractWithDocumentHistory(restoringRevisionId)) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="max-h-[min(86vh,760px)] overflow-hidden p-0 sm:max-w-5xl"
        showCloseButton={canInteract}
        aria-busy={!canInteract}
        onEscapeKeyDown={(event) => {
          if (!canInteract) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (!canInteract) event.preventDefault();
        }}
      >
        <DialogHeader className="border-b px-5 py-4 pe-12 text-start">
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            {t('versionHistory')}
          </DialogTitle>
          <DialogDescription>{t('versionHistoryDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-72 overflow-hidden md:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="max-h-[min(72vh,640px)] overflow-y-auto border-b bg-muted/15 p-2 md:border-e md:border-b-0">
            {revisions.isLoading ? (
              <div className="space-y-1.5 p-1" aria-hidden>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : revisions.isError ? (
              <div className="grid min-h-48 place-items-center px-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">{t('historyLoadFailed')}</p>
                  <Button
                    type="button"
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    disabled={!canInteract}
                    onClick={() => void revisions.refetch()}
                  >
                    <RefreshCw />
                    {t('reload')}
                  </Button>
                </div>
              </div>
            ) : revisions.data?.length ? (
              <ol aria-label={t('versionHistory')}>
                {revisions.data.map((revision) => {
                  const current = revision.version === version;
                  const selected = selectedRevisionId === revision.id;
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
                        disabled={!canInteract}
                        onClick={() => {
                          setRestoreFailed(false);
                          setSelectedRevisionId(revision.id);
                        }}
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
                          <span
                            className="mt-1 block truncate text-xs text-muted-foreground"
                            dir="auto"
                          >
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
            ) : (
              <div className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted-foreground">
                {t('noHistory')}
              </div>
            )}
          </aside>

          <section className="max-h-[min(72vh,640px)] overflow-y-auto">
            {selectedRevision.isLoading ? (
              <div className="space-y-3 p-6" aria-hidden>
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : selectedRevision.isError ? (
              <div className="grid min-h-72 place-items-center px-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">{t('historyLoadFailed')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={!canInteract}
                    onClick={() => void selectedRevision.refetch()}
                  >
                    <RefreshCw />
                    {t('reload')}
                  </Button>
                </div>
              </div>
            ) : selectedRevision.data ? (
              <article className="mx-auto max-w-3xl px-6 py-7">
                <header className="mb-6 flex items-start justify-between gap-4 border-b pb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('savedVersion', { version: selectedRevision.data.version })}
                    </p>
                    <h3 className="mt-1 truncate text-xl font-semibold" dir="auto">
                      {selectedRevision.data.title.trim() || t('untitled')}
                    </h3>
                  </div>
                  {canRestore && selectedRevision.data.version !== version && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canInteract}
                      onClick={() => void restoreRevision(selectedRevision.data.id)}
                    >
                      {restoringRevisionId === selectedRevision.data.id ? (
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
                  key={selectedRevision.data.id}
                  defaultValue={selectedRevision.data.content}
                  defaultJson={selectedRevision.data.contentJson}
                  editable={false}
                  placeholder=""
                  className="text-sm leading-6"
                  onReady={noop}
                  onChange={noop}
                  onBlur={noop}
                />
              </article>
            ) : (
              <div className="grid min-h-72 place-items-center px-6 text-sm text-muted-foreground">
                {t('selectVersion')}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function canInteractWithDocumentHistory(restoringRevisionId: number | null): boolean {
  return restoringRevisionId === null;
}

export function canApplyDocumentHistoryRestore({
  attempt,
  currentAttempt,
  open,
  mounted,
}: {
  attempt: number;
  currentAttempt: number;
  open: boolean;
  mounted: boolean;
}): boolean {
  return mounted && open && attempt === currentAttempt;
}
