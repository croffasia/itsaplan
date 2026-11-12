import { useState } from 'react';
import { useIconHover } from '@animateicons/react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ADD_H } from '../../utils/timeline';
import { QuickAddInput } from '../shared/QuickAddInput';

// The last row of a section: the add control in the sticky label column, and an
// empty day track so the gridlines run on.
export function TimelineQuickAdd({
  indented,
  labelW,
  trackWidth,
  dayLines,
  todayInRange,
  todayLeft,
  onAdd,
}: {
  indented: boolean;
  labelW: number;
  trackWidth: number;
  dayLines: { backgroundImage: string };
  todayInRange: boolean;
  todayLeft: number;
  onAdd: (title: string) => Promise<void>;
}) {
  const t = useTranslations('workItems');
  const { ref, triggerProps } = useIconHover();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex border-b" style={{ height: ADD_H }}>
      <div
        className={cn(
          'sticky left-0 z-15 flex shrink-0 items-center border-r bg-background pr-3',
          indented ? 'pl-7' : 'pl-3',
        )}
        style={{ width: labelW }}
      >
        {open ? (
          <QuickAddInput onAdd={onAdd} onClose={() => setOpen(false)} className="h-6 md:text-sm" />
        ) : (
          <button
            type="button"
            {...triggerProps}
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <PlusIcon ref={ref} size={12} />
            {t('addWorkItem')}
          </button>
        )}
      </div>
      <div className="relative" style={{ width: trackWidth, ...dayLines }}>
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 z-0 w-px bg-primary/40"
            style={{ left: todayLeft }}
          />
        )}
      </div>
    </div>
  );
}
