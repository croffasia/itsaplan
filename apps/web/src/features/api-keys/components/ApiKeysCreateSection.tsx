'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import ApiKeysCreateDialog from './ApiKeysCreateDialog';

export default function ApiKeysCreateSection({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('apiKeys');
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-1 flex items-center justify-between border-b pb-1">
        <span className="text-xs font-medium text-muted-foreground">{t('sectionTitle')}</span>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5" />
          {t('create')}
        </Button>
      </div>

      {open && <ApiKeysCreateDialog onClose={() => setOpen(false)} onCreated={onCreated} />}
    </>
  );
}
