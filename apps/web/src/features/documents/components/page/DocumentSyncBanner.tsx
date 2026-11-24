import { CircleAlert, LifeBuoy, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { DocumentSyncState } from '../../hooks/useDocumentCollaboration';
import DocumentBanner, { BANNER_BUTTON } from './DocumentBanner';

// Offline needs no Retry: the session flushes again when the browser is back online.
export default function DocumentSyncBanner({
  state,
  onRetry,
  recoveryConflict,
  onExportRecovery,
  onDiscardRecovery,
}: {
  state: DocumentSyncState;
  onRetry: () => void;
  recoveryConflict: boolean;
  onExportRecovery: () => void;
  onDiscardRecovery: () => void;
}) {
  const t = useTranslations('documents.sync');

  if (recoveryConflict) {
    return (
      <DocumentBanner
        icon={LifeBuoy}
        tone="warn"
        actions={
          <>
            <Button variant="ghost" size="sm" className={BANNER_BUTTON} onClick={onExportRecovery}>
              {t('exportRecovery')}
            </Button>
            <Button variant="ghost" size="sm" className={BANNER_BUTTON} onClick={onDiscardRecovery}>
              {t('discardRecovery')}
            </Button>
          </>
        }
      >
        {t('recoveryConflict')}
      </DocumentBanner>
    );
  }
  if (state === 'connecting') {
    return (
      <DocumentBanner icon={LoaderCircle} spin>
        {t('connecting')}
      </DocumentBanner>
    );
  }
  if (state === 'offline') {
    return (
      <DocumentBanner icon={WifiOff} tone="warn">
        {t('offline')}
      </DocumentBanner>
    );
  }
  if (state !== 'error' && state !== 'conflict') return null;
  return (
    <DocumentBanner
      icon={CircleAlert}
      tone="danger"
      actions={
        <Button variant="ghost" size="sm" className={BANNER_BUTTON} onClick={onRetry}>
          <RefreshCw />
          {t('retry')}
        </Button>
      }
    >
      {t(state)}
    </DocumentBanner>
  );
}
