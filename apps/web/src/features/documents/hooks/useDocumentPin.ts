import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useSetDocumentPinned } from '../services/documents.service';

// Puts a page on the Docs home or takes it off, and says which.
export function useDocumentPin(projectKey: string) {
  const t = useTranslations('documents');
  const pin = useSetDocumentPinned(projectKey);

  const setPinned = (document: Pick<ProjectDocumentSummary, 'id' | 'title'>, isPinned: boolean) => {
    const title = document.title.trim() || t('untitled');
    pin.mutate(
      { documentId: document.id, isPinned },
      {
        onSuccess: () =>
          toast.success(isPinned ? t('pinnedToHome', { title }) : t('unpinned', { title })),
      },
    );
  };

  return { setPinned, pending: pin.isPending };
}
