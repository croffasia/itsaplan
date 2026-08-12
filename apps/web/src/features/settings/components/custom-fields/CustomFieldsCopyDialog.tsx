'use client';

import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';

// Asks, before copying, whether to include the type-scoped fields or copy only the
// global ones. Shown only when the project has type-scoped fields.
export default function CustomFieldsCopyDialog({
  globalCount,
  scopedCount,
  onChoose,
  onClose,
}: {
  globalCount: number;
  scopedCount: number;
  onChoose: (includeTypeScoped: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations('settings.customFields');

  return (
    <Modal title={t('copyTitle')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('copyQuestion', { scoped: scopedCount, global: globalCount })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onChoose(false)} disabled={globalCount === 0}>
            {t('copyGlobalOnly')}
          </Button>
          <Button onClick={() => onChoose(true)}>{t('copyIncludeScoped')}</Button>
        </div>
      </div>
    </Modal>
  );
}
