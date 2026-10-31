import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, EyeOff, Layers, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { cn } from '@/lib/utils';
import { ViewIcon } from '@/utils/viewIcons';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Mobile view picker: the tab strip collapses into a dropdown showing the active
// view, listing All + saved views (searchable) and a New view action. Item values
// are ids, not names — two views may share a name — and the name is passed as a
// search keyword. The views the person hid stay folded under their own item, since a
// phone does not arrange the row and they are still opened from here.
export default function MobileViewSwitcher({
  views,
  activeViewId,
  canCreate,
  onSelect,
  onNewView,
}: {
  views: View[];
  activeViewId: number | null;
  canCreate: boolean;
  onSelect: (id: number | null) => void;
  onNewView: () => void;
}) {
  const t = useTranslations('views');
  const [open, setOpen] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [search, setSearch] = useState('');
  const active = activeViewId != null ? (views.find((v) => v.id === activeViewId) ?? null) : null;
  const hidden = views.filter((v) => v.hidden);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setUnfolded(false);
      setSearch('');
    }
  }

  function viewItem(v: View) {
    return (
      <CommandItem
        key={v.id}
        value={String(v.id)}
        keywords={[v.name]}
        onSelect={() => {
          onSelect(v.id);
          changeOpen(false);
        }}
        className={cn(activeViewId === v.id && 'bg-accent/50')}
      >
        <ViewIcon name={v.icon} className="size-4" />
        <span className="min-w-0 flex-1 truncate">{v.name}</span>
        {activeViewId === v.id && <Check className="size-4 shrink-0" />}
      </CommandItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t('switchView')}
          className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border px-3 text-sm whitespace-nowrap transition-colors hover:bg-accent"
        >
          {active ? (
            <ViewIcon name={active.icon} className="size-4 shrink-0" />
          ) : (
            <Layers className="size-4 shrink-0" />
          )}
          <span className="truncate font-medium">{active ? active.name : t('all')}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder={t('searchViews')} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{t('noViews')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                keywords={[t('all')]}
                onSelect={() => {
                  onSelect(null);
                  changeOpen(false);
                }}
                className={cn(activeViewId === null && 'bg-accent/50')}
              >
                <Layers className="size-4" />
                <span className="min-w-0 flex-1 truncate">{t('all')}</span>
                {activeViewId === null && <Check className="size-4 shrink-0" />}
              </CommandItem>
              {views.filter((v) => !v.hidden).map(viewItem)}
            </CommandGroup>
            {hidden.length > 0 && search !== '' && (
              <CommandGroup heading={t('hiddenViews', { count: hidden.length })}>
                {hidden.map(viewItem)}
              </CommandGroup>
            )}
            {hidden.length > 0 && search === '' && (
              <CommandGroup>
                <CommandItem
                  value="__hidden__"
                  onSelect={() => setUnfolded((was) => !was)}
                  className={cn(
                    !unfolded && hidden.some((v) => v.id === activeViewId) && 'bg-accent/50',
                  )}
                >
                  <EyeOff className="size-4" />
                  <span className="min-w-0 flex-1 truncate">
                    {t('hiddenViews', { count: hidden.length })}
                  </span>
                  {unfolded ? (
                    <ChevronDown className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 rtl:rotate-180" />
                  )}
                </CommandItem>
                {unfolded && hidden.map(viewItem)}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value={t('newView')}
                  onSelect={() => {
                    onNewView();
                    changeOpen(false);
                  }}
                >
                  <Plus className="size-4" />
                  {t('newView')}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
