'use client';

import { Pin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

// The menu stays open, so the switch shows the new state.
export default function DocumentStickyToolbarItem({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations('documents');

  return (
    <DropdownMenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      onSelect={(event) => {
        event.preventDefault();
        onChange(!checked);
      }}
    >
      <Pin />
      <span className="flex-1">{t('stickyToolbar')}</span>
      <Switch checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
    </DropdownMenuItem>
  );
}
