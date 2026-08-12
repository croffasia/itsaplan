'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiKey } from '@/lib/auth-client';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import type { ApiKeyRow } from '../services/apiKeys.service';

export default function ApiKeysDeleteDialog({
  apiKey: target,
  onClose,
  onDeleted,
}: {
  apiKey: ApiKeyRow;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations('apiKeys');

  return (
    <ConfirmDialog
      title={t('deleteDialog.title')}
      confirmLabel={t('deleteDialog.confirm')}
      onClose={onClose}
      onConfirm={async () => {
        // API key delete is a better-auth call, not a React Query mutation, so the
        // global error toast does not cover it. Toast the failure here, then throw
        // to keep the dialog open.
        const { error } = await apiKey.delete({ keyId: target.id });
        if (error) {
          const message = error.message ?? t('deleteDialog.error');
          toast.error(message);
          throw new Error(message);
        }
        await onDeleted();
      }}
    >
      <p className="text-sm">
        <span className="font-medium text-foreground">{target.name ?? t('fallbackName')}</span>
        {target.start && <span className="text-muted-foreground"> · {target.start}…</span>}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t('deleteDialog.description')}</p>
    </ConfirmDialog>
  );
}
