import { useState } from 'react';
import { useCommandState } from 'cmdk';
import { ChevronDown, ChevronRight, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { cn } from '@/lib/utils';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import MobileViewItem from '@/components/layout/MobileViewItem';

// The views the person hid, folded under their own item of the mobile picker: a phone does not
// arrange the row, but they still open from here. A search finds them under their heading.
export default function MobileHiddenViews({
  hidden,
  activeViewId,
  onSelect,
}: {
  hidden: View[];
  activeViewId: number | null;
  onSelect: (id: number) => void;
}) {
  const t = useTranslations('views');
  const searching = useCommandState((state) => state.search !== '');
  const [unfolded, setUnfolded] = useState(false);
  const label = t('hiddenViews', { count: hidden.length });
  const items = hidden.map((view) => (
    <MobileViewItem
      key={view.id}
      view={view}
      active={view.id === activeViewId}
      onSelect={onSelect}
    />
  ));

  if (searching) return <CommandGroup heading={label}>{items}</CommandGroup>;
  return (
    <CommandGroup>
      <CommandItem
        value="__hidden__"
        onSelect={() => setUnfolded((was) => !was)}
        className={cn(!unfolded && hidden.some((v) => v.id === activeViewId) && 'bg-accent/50')}
      >
        <EyeOff className="size-4" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {unfolded ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0 rtl:rotate-180" />
        )}
      </CommandItem>
      {unfolded && items}
    </CommandGroup>
  );
}
