import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentsArchivePath } from '@/utils/paths';
import {
  useArchiveDocument,
  useMoveDocument,
  useSetDocumentFavorite,
} from '../services/documents.service';
import type { DocumentPlacement } from '../utils/documentMove';
import { useDocumentPin } from './useDocumentPin';

// The writes a row of the page tree makes. A reorder and a favorite show in the rail, so only
// the others toast.
export function useDocumentTreeActions(projectKey: string, activeId: number | null) {
  const t = useTranslations('documents');
  const router = useRouter();
  const move = useMoveDocument(projectKey);
  const favorite = useSetDocumentFavorite(projectKey);
  const pin = useDocumentPin(projectKey);
  const archive = useArchiveDocument(projectKey);
  const name = (document: ProjectDocumentSummary) => document.title.trim() || t('untitled');
  const ref = (document: ProjectDocumentSummary) => ({
    documentId: document.id,
    version: document.version,
  });

  return {
    movePending: move.isPending,
    pending: move.isPending || pin.pending || archive.isPending,
    reorder: (document: ProjectDocumentSummary, placement: DocumentPlacement) =>
      move.mutate({ ...ref(document), ...placement }),
    moveTo: (
      document: ProjectDocumentSummary,
      placement: DocumentPlacement,
      parent: ProjectDocumentSummary | null,
    ) =>
      move.mutate(
        { ...ref(document), ...placement },
        {
          onSuccess: () =>
            toast.success(parent ? t('movedTo', { title: name(parent) }) : t('movedToTopLevel')),
        },
      ),
    toggleFavorite: (document: ProjectDocumentSummary) =>
      favorite.mutate({ documentId: document.id, isFavorite: !document.isFavorite }),
    togglePinned: (document: ProjectDocumentSummary) => pin.setPinned(document, !document.isPinned),
    archive: (document: ProjectDocumentSummary) =>
      archive.mutate(ref(document), {
        onSuccess: () => {
          toast.success(t('archivedPage', { title: name(document) }));
          if (document.id === activeId) router.push(documentsArchivePath(projectKey));
        },
      }),
  };
}
