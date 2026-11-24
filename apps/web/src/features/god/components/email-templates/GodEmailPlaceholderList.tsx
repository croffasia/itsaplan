'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailPlaceholderItem {
  name: string;
  description: string | null;
  used: boolean;
  missing?: boolean;
}

export default function GodEmailPlaceholderList({
  title,
  items,
  onInsert,
}: {
  title: string;
  items: EmailPlaceholderItem[];
  onInsert: (name: string) => void;
}) {
  const t = useTranslations('god.emailTemplates');

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{title}</span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-2 gap-y-0.5">
        {items.map(({ name, description, used, missing }) => (
          <Button
            key={name}
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 justify-start gap-2 font-normal"
            onClick={() => onInsert(name)}
          >
            <code dir="ltr" className="font-mono text-xs">{`{${name}}`}</code>
            <span className="min-w-0 flex-1 truncate text-start text-muted-foreground">
              {description}
            </span>
            {missing && <span className="text-xs text-warning">{t('required')}</span>}
            {used && <Check className="size-3.5 text-muted-foreground" />}
          </Button>
        ))}
      </div>
    </div>
  );
}
