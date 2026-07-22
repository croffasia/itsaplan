import { useMemo, useState } from 'react';
import { ACTION_ICON_KEYS, ACTION_ICONS, actionIcon } from '@/utils/actionIcons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function SettingsActionIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const Current = actionIcon(value);

  const keys = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ACTION_ICON_KEYS.filter((k) => k.includes(q)) : ACTION_ICON_KEYS;
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Action icon"
        >
          <Current className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons"
          className="mb-2 h-8"
        />
        <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
          {keys.map((key) => {
            const Icon = ACTION_ICONS[key];
            const active = key === value;
            return (
              <button
                key={key}
                type="button"
                title={key}
                aria-label={key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent',
                  active && 'bg-accent text-accent-foreground ring-2 ring-ring',
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
          {keys.length === 0 && (
            <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
              No icons found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
