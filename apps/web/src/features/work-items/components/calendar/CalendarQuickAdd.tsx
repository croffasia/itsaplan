import { useState } from 'react';
import { useIconHover } from '@animateicons/react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';
import { QuickAddInput } from '../shared/QuickAddInput';

const REVEAL = 'opacity-0 group-hover/add:opacity-100 focus-visible:opacity-100';

// Shows while the pointer is over the nearest `group/add` ancestor: a column or a
// day.
export function CalendarQuickAdd({
  onAdd,
  compact = false,
}: {
  onAdd: (title: string) => Promise<void>;
  // An icon instead of a full-width button, for a month cell.
  compact?: boolean;
}) {
  const t = useTranslations('workItems');
  const { ref, triggerProps } = useIconHover();
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <QuickAddInput
        onAdd={onAdd}
        onClose={() => setOpen(false)}
        className={cn('md:text-xs', compact ? 'h-5 flex-1 px-1 py-0' : 'h-8 shrink-0')}
      />
    );
  }

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            icon={PlusIcon}
            className={cn('p-0.5', REVEAL)}
            onClick={() => setOpen(true)}
            aria-label={t('addWorkItem')}
          />
        </TooltipTrigger>
        <TooltipContent>{t('addWorkItem')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      {...triggerProps}
      className={cn('w-full shrink-0 text-muted-foreground', REVEAL)}
      onClick={() => setOpen(true)}
    >
      <PlusIcon ref={ref} size={16} />
      {t('addWorkItem')}
    </Button>
  );
}
