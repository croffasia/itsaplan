import { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ViewTabLabel from '@/components/layout/ViewTabLabel';

// The views the caller hid from their tab row: each one still opens from here, or is shown
// again. A hidden view that is open has no tab, so this button stands for it.
export default function HiddenViewsMenu({
  hidden,
  activeViewId,
  onSelect,
  onShow,
}: {
  hidden: View[];
  activeViewId: number | null;
  onSelect: (id: number) => void;
  onShow: (view: View) => void;
}) {
  const t = useTranslations('views');
  const [open, setOpen] = useState(false);
  const hiddenOpen = hidden.some((view) => view.id === activeViewId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm',
            hiddenOpen
              ? 'bg-secondary font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <EyeOff className="size-3.5" />
          {t('hiddenViews', { count: hidden.length })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {hidden.map((view) => (
          <div key={view.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect(view.id);
              }}
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded px-2 py-1 text-start text-sm hover:bg-accent"
            >
              <ViewTabLabel view={view} />
              {view.id === activeViewId && <Check className="size-3.5 shrink-0" />}
            </button>
            <button
              type="button"
              onClick={() => onShow(view)}
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-accent"
            >
              <Eye className="size-3" /> {t('show')}
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
