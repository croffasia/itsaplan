import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ViewIcon, VIEW_ICON_NAMES, VIEW_ICONS } from '@/utils/viewIcons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The square icon button in the view edit bar, opening a grid to pick (or clear)
// the view's icon. Rendered inline in the edit bar, not a modal.
export default function ViewIconPicker({
  icon,
  onChange,
}: {
  icon: string | null;
  onChange: (icon: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="View icon"
          className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground hover:bg-secondary/80"
        >
          <ViewIcon name={icon} className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="flex flex-wrap gap-1">
          {VIEW_ICON_NAMES.map((n) => {
            const Icon = VIEW_ICONS[n];
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChange(icon === n ? null : n);
                  setOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md border transition-colors',
                  icon === n
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
