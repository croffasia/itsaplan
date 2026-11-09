import { useState } from 'react';
import { ListOrdered, MoreHorizontal, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The end of the caller's tab row: the row as a whole, back to the project's order or, for
// whoever edits views, made the project's.
export default function TabRowMenu({
  canPinProjectOrder,
  onReset,
  onPinProjectOrder,
}: {
  canPinProjectOrder: boolean;
  onReset: () => void;
  onPinProjectOrder: () => void;
}) {
  const t = useTranslations('views');
  const [open, setOpen] = useState(false);
  const item =
    'flex w-full items-center gap-2 rounded px-2 py-1 text-start text-sm hover:bg-accent';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t('tabRow')}
          className="flex shrink-0 items-center rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <button
          type="button"
          title={t('resetTabRowHint')}
          onClick={() => {
            setOpen(false);
            onReset();
          }}
          className={item}
        >
          <RotateCcw className="size-3.5 shrink-0" /> {t('resetTabRow')}
        </button>
        {canPinProjectOrder && (
          <button
            type="button"
            title={t('pinProjectOrderHint')}
            onClick={() => {
              setOpen(false);
              onPinProjectOrder();
            }}
            className={item}
          >
            <ListOrdered className="size-3.5 shrink-0" /> {t('pinProjectOrder')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
