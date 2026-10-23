'use client';

import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

export default function InboxDeleteCompletedDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common');

  return (
    <ConfirmDialog
      title={t('deleteAllCompleted')}
      confirmLabel={tCommon('delete')}
      onConfirm={async () => {
        await onConfirm();
        onClose();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">{t('deleteAllCompletedDescription')}</p>
    </ConfirmDialog>
  );
}
