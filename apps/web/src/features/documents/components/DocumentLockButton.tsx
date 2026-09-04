'use client';

import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function DocumentLockButton({
  locked,
  disabled,
  onChange,
}: {
  locked: boolean;
  disabled: boolean;
  onChange: (locked: boolean) => void;
}) {
  const t = useTranslations('documents');
  const label = locked ? t('unlock') : t('lock');

  return (
    <Button
      type="button"
      variant={locked ? 'secondary' : 'ghost'}
      size="icon-sm"
      disabled={disabled}
      aria-label={label}
      aria-pressed={locked}
      title={label}
      onClick={() => onChange(!locked)}
    >
      {locked ? <LockKeyhole /> : <LockKeyholeOpen />}
    </Button>
  );
}
