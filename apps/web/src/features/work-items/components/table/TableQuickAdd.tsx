import { useState } from 'react';
import { useIconHover } from '@animateicons/react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { QuickAddInput } from '../shared/QuickAddInput';

// The last row of a section. Its title input sits in the title column.
export function TableQuickAdd({
  indented,
  gridTemplate,
  onAdd,
}: {
  indented: boolean;
  gridTemplate: string;
  onAdd: (title: string) => Promise<void>;
}) {
  const t = useTranslations('workItems');
  const { ref, triggerProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const rowFrame = cn('border-b pe-4', indented ? 'ps-9' : 'ps-4');

  if (open) {
    return (
      <div
        className={cn('grid gap-3 py-0.5', rowFrame)}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <QuickAddInput onAdd={onAdd} onClose={() => setOpen(false)} className="h-6 md:text-sm" />
      </div>
    );
  }

  return (
    <button
      type="button"
      {...triggerProps}
      onClick={() => setOpen(true)}
      className={cn(
        'flex w-full items-center gap-1.5 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-accent/20 hover:text-foreground',
        rowFrame,
      )}
    >
      <PlusIcon ref={ref} size={12} />
      {t('addWorkItem')}
    </button>
  );
}
