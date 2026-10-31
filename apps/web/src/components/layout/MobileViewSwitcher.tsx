import { useState } from 'react';
import { Check, ChevronDown, Layers, Plus } from 'lucide-react';
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
import MobileHiddenViews from '@/components/layout/MobileHiddenViews';
import MobileViewItem from '@/components/layout/MobileViewItem';

// Mobile view picker: the tab strip collapses into a dropdown showing the active
// view, listing All + saved views (searchable) and a New view action. It is given the
// hidden views too, so it names one opened by its link.
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
  const active = activeViewId != null ? (views.find((v) => v.id === activeViewId) ?? null) : null;
  const hidden = views.filter((v) => v.hidden);

  function selectView(id: number) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <CommandInput placeholder={t('searchViews')} />
          <CommandList>
            <CommandEmpty>{t('noViews')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                keywords={[t('all')]}
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className={cn(activeViewId === null && 'bg-accent/50')}
              >
                <Layers className="size-4" />
                <span className="min-w-0 flex-1 truncate">{t('all')}</span>
                {activeViewId === null && <Check className="size-4 shrink-0" />}
              </CommandItem>
              {views
                .filter((v) => !v.hidden)
                .map((v) => (
                  <MobileViewItem
                    key={v.id}
                    view={v}
                    active={v.id === activeViewId}
                    onSelect={selectView}
                  />
                ))}
            </CommandGroup>
            {hidden.length > 0 && (
              <MobileHiddenViews
                hidden={hidden}
                activeViewId={activeViewId}
                onSelect={selectView}
              />
            )}
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value={t('newView')}
                  onSelect={() => {
                    onNewView();
                    setOpen(false);
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
