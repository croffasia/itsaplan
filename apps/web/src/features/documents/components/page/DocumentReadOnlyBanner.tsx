import { Archive, Eye, Lock, LockOpen, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/dates';
import DocumentBanner, { BANNER_BUTTON } from './DocumentBanner';

// Why the page cannot be edited, with the way out when the user has one.
export default function DocumentReadOnlyBanner({
  document,
  canEdit,
  canManage,
  canManageLifecycle,
  busy,
  onUnlock,
  onRestore,
  onDelete,
}: {
  document: ProjectDocumentSummary;
  canEdit: boolean;
  canManage: boolean;
  canManageLifecycle: boolean;
  busy: boolean;
  onUnlock: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('documents');

  if (document.archivedAt !== null) {
    return (
      <DocumentBanner
        icon={Archive}
        actions={
          canManageLifecycle && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={BANNER_BUTTON}
                disabled={busy}
                onClick={onRestore}
              >
                <RotateCcw />
                {t('restore')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`${BANNER_BUTTON} text-destructive hover:text-destructive`}
                disabled={busy}
                onClick={onDelete}
              >
                {t('deletePermanently')}
              </Button>
            </>
          )
        }
      >
        {t('archivedBanner', { date: formatDate(document.archivedAt) })}
      </DocumentBanner>
    );
  }
  if (!canEdit) {
    return <DocumentBanner icon={Eye}>{t('viewOnlyBanner')}</DocumentBanner>;
  }
  if (!document.isLocked) return null;
  return (
    <DocumentBanner
      icon={Lock}
      actions={
        canManage && (
          <Button
            variant="ghost"
            size="sm"
            className={BANNER_BUTTON}
            disabled={busy}
            onClick={onUnlock}
          >
            <LockOpen />
            {t('unlockShort')}
          </Button>
        )
      }
    >
      {t('lockedBanner')}
    </DocumentBanner>
  );
}
