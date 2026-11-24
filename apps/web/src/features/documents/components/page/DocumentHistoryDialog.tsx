'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { type ProjectDocument, getDocumentRevision } from '@/lib/api/endpoints/documents';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import {
  useDocumentRevisionsQuery,
  useRestoreDocumentRevision,
} from '../../services/documents.service';
import DocumentHistoryList from './DocumentHistoryList';
import DocumentHistoryPreview from './DocumentHistoryPreview';

export default function DocumentHistoryDialog({
  open,
  projectKey,
  documentId,
  version,
  initialRevisionId,
  authorNames,
  canRestore,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  projectKey: string;
  documentId: number;
  version: number;
  initialRevisionId: number | null;
  authorNames: Record<string, string>;
  canRestore: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (document: ProjectDocument) => void;
}) {
  const t = useTranslations('documents');
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
    queryFn: () => getDocumentRevision(projectKey, documentId, selectedRevisionId!),
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
    if (!selectionExists) {
      const initial = revisions.data?.find((item) => item.id === initialRevisionId);
      setSelectedRevisionId(initial?.id ?? revisions.data?.[0]?.id ?? null);
    }
  }, [open, revisions.data, selectedRevisionId, initialRevisionId]);

  const restoreRevision = async (revisionId: number) => {
    if (restoreLockRef.current) return;
    restoreLockRef.current = true;
    const attempt = ++restoreAttemptRef.current;
    const stillCurrent = () =>
      canApplyDocumentHistoryRestore({
        attempt,
        currentAttempt: restoreAttemptRef.current,
        open: openRef.current,
        mounted: mountedRef.current,
      });
    setRestoringRevisionId(revisionId);
    setRestoreFailed(false);

    try {
      const updated = await restore.mutateAsync({ documentId, revisionId, version });
      if (stillCurrent()) {
        onRestored(updated);
        onOpenChange(false);
      }
    } catch {
      if (stillCurrent()) setRestoreFailed(true);
    } finally {
      restoreLockRef.current = false;
      if (mountedRef.current) setRestoringRevisionId(null);
    }
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && !canInteract) return;
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
            <DocumentHistoryList
              revisions={revisions}
              version={version}
              selectedId={selectedRevisionId}
              authorNames={authorNames}
              disabled={!canInteract}
              onSelect={(revisionId) => {
                setRestoreFailed(false);
                setSelectedRevisionId(revisionId);
              }}
            />
          </aside>

          <section className="max-h-[min(72vh,640px)] overflow-y-auto">
            <DocumentHistoryPreview
              revision={selectedRevision}
              version={version}
              canRestore={canRestore}
              restoringRevisionId={restoringRevisionId}
              restoreFailed={restoreFailed}
              disabled={!canInteract}
              onRestore={(revisionId) => void restoreRevision(revisionId)}
            />
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
