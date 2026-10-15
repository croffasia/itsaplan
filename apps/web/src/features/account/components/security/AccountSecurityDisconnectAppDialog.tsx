'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { disconnectApp, type ConnectedApp } from '@/lib/api/endpoints/connectedApps';

export default function AccountSecurityDisconnectAppDialog({
  app,
  onClose,
  onDisconnected,
}: {
  app: ConnectedApp;
  onClose: () => void;
  onDisconnected: () => void | Promise<void>;
}) {
  const t = useTranslations('account.security');
  return (
    <ConfirmDialog
      title={t('disconnectAppTitle', { name: app.name })}
      confirmLabel={t('disconnectApp')}
      onClose={onClose}
      onConfirm={async () => {
        // A plain request, not a React Query mutation, so the global error toast does
        // not cover it; throwing keeps the dialog open.
        try {
          await disconnectApp(app.clientId);
        } catch (error) {
          toast.error(t('disconnectAppFailed'));
          throw error;
        }
        await onDisconnected();
      }}
    >
      <p className="text-sm text-muted-foreground">{t('disconnectAppWarning')}</p>
    </ConfirmDialog>
  );
}
