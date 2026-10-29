import { useState } from 'react';
import { Eye, EyeOff, ListOrdered, MoreHorizontal, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ViewTabLabel from '@/components/layout/ViewTabLabel';

// The end of the caller's tab row: the views they hid, to show again, and the row as a
// whole — back to the project's order, or, for whoever edits views, made the project's.
export default function TabRowMenu({
  hidden,
  canPinProjectOrder,
  onShow,
  onReset,
  onPinProjectOrder,
}: {
  hidden: View[];
  canPinProjectOrder: boolean;
  onShow: (view: View) => void;
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
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {hidden.length > 0 ? (
            <>
              <EyeOff className="size-3.5" />
              {t('hiddenViews', { count: hidden.length })}
            </>
          ) : (
            <MoreHorizontal className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {hidden.map((view) => (
          <div key={view.id} className="flex items-center gap-2 px-2 py-1 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
              <ViewTabLabel view={view} />
            </span>
            <button
              type="button"
              onClick={() => onShow(view)}
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-accent"
            >
              <Eye className="size-3" /> {t('show')}
            </button>
          </div>
        ))}
        {hidden.length > 0 && <div className="my-1 border-t" />}
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
