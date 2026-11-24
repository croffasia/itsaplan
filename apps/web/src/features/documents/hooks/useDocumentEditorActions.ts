import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  useArchiveDocument,
  useMoveDocument,
  useRestoreDocument,
  useSetDocumentAccess,
  useSetDocumentFavorite,
  useSetDocumentLocked,
  useTransferDocumentOwnership,
  useUploadDocumentAsset,
  useUpdateDocument,
} from '../services/documents.service';
import type { DocumentPlacement } from '../utils/documentMove';
import type { useDocumentActionGate } from './useDocumentActionGate';
import type { useDocumentCollaboration } from './useDocumentCollaboration';
import type { useDocumentDraft } from './useDocumentDraft';

// The writes of an open page. A versioned write runs in the action gate: it flushes the
// editing session and saves the draft, then sends the version that came back.
export function useDocumentEditorActions({
  projectKey,
  document,
  gate,
  draft,
  collaboration,
  usesSession,
  onDuplicate,
  onArchived,
}: {
  projectKey: string;
  document: ProjectDocument;
  gate: ReturnType<typeof useDocumentActionGate>;
  draft: ReturnType<typeof useDocumentDraft>;
  collaboration: ReturnType<typeof useDocumentCollaboration>;
  usesSession: boolean;
  onDuplicate: (title: string, version: number) => Promise<void>;
  onArchived?: () => void;
}) {
  const t = useTranslations('documents');
  const updateDocument = useUpdateDocument(projectKey);
  const setDocumentAccess = useSetDocumentAccess(projectKey);
  const setDocumentLocked = useSetDocumentLocked(projectKey);
  const archiveDocument = useArchiveDocument(projectKey);
  const moveDocument = useMoveDocument(projectKey);
  const restoreDocument = useRestoreDocument(projectKey);
  const setDocumentFavorite = useSetDocumentFavorite(projectKey);
  const transferOwnership = useTransferDocumentOwnership(projectKey);
  const uploadDocumentAsset = useUploadDocumentAsset(projectKey, document.id);
  const documentId = document.id;
  const pending =
    updateDocument.isPending ||
    setDocumentAccess.isPending ||
    setDocumentLocked.isPending ||
    archiveDocument.isPending ||
    moveDocument.isPending ||
    restoreDocument.isPending ||
    setDocumentFavorite.isPending;

  const prepareVersion = async () => {
    if (pending || draft.saveState === 'conflict' || draft.saveState === 'error') return null;
    const synchronized = usesSession ? await collaboration.flush() : null;
    if (usesSession && !synchronized) return null;
    const updatedDraft = await draft.save();
    if (draft.dirty && !updatedDraft) return null;
    return updatedDraft?.version ?? synchronized?.version ?? draft.version;
  };

  const runVersioned = (action: (baseVersion: number) => Promise<ProjectDocument>) =>
    gate.run(async () => {
      const baseVersion = await prepareVersion();
      if (baseVersion === null) return null;
      try {
        const changed = await action(baseVersion);
        draft.adoptServerDocument(changed);
        return changed;
      } catch {
        // The shared mutation error handler reports the failure. Keeping the
        // current document intact lets the user retry without losing their draft.
        return null;
      }
    });

  return {
    pending,
    favoritePending: setDocumentFavorite.isPending,
    setAccess: (isPrivate: boolean, memberIds?: string[]) => {
      void runVersioned((version) =>
        setDocumentAccess.mutateAsync({ documentId, version, isPrivate, memberIds }),
      );
    },
    setLocked: (locked: boolean) => {
      void runVersioned((version) =>
        setDocumentLocked.mutateAsync({ documentId, version, locked }),
      );
    },
    setIcon: (icon: string | null) => {
      void runVersioned((version) =>
        updateDocument.mutateAsync({ documentId, patch: { version, icon } }),
      );
    },
    transferOwner: (ownerUserId: string) => {
      void runVersioned((version) =>
        transferOwnership.mutateAsync({ documentId, version, ownerUserId }),
      );
    },
    restore: () => {
      void runVersioned((version) => restoreDocument.mutateAsync({ documentId, version }));
    },
    moveTo: (move: DocumentPlacement, parent: ProjectDocumentSummary | null) => {
      void runVersioned((version) =>
        moveDocument.mutateAsync({ documentId, version, ...move }),
      ).then((changed) => {
        if (!changed) return;
        toast.success(
          parent
            ? t('movedTo', { title: parent.title.trim() || t('untitled') })
            : t('movedToTopLevel'),
        );
      });
    },
    archive: () => {
      void runVersioned((version) => archiveDocument.mutateAsync({ documentId, version })).then(
        (changed) => {
          if (!changed) return;
          toast.success(t('archivedPage', { title: draft.title.trim() || t('untitled') }));
          onArchived?.();
        },
      );
    },
    duplicate: () => {
      void gate.run(async () => {
        const baseVersion = await prepareVersion();
        if (baseVersion !== null) await onDuplicate(draft.title, baseVersion);
      });
    },
    setFavorite: (isFavorite: boolean) => {
      void setDocumentFavorite.mutateAsync({ documentId, isFavorite }).catch(() => undefined);
    },
    uploadImage: (file: File) => uploadDocumentAsset.mutateAsync(file),
  };
}
