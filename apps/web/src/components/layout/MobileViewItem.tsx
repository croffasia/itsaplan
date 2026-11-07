import { Check } from 'lucide-react';
import type { View } from '@/lib/api/endpoints/views';
import { cn } from '@/lib/utils';
import { ViewIcon } from '@/utils/viewIcons';
import { CommandItem } from '@/components/ui/command';

// A saved view in the mobile picker. Its value is the id, not the name — two views may share
// a name — and the name is passed as a search keyword.
export default function MobileViewItem({
  view,
  active,
  onSelect,
}: {
  view: View;
  active: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <CommandItem
      value={String(view.id)}
      keywords={[view.name]}
      onSelect={() => onSelect(view.id)}
      className={cn(active && 'bg-accent/50')}
    >
      <ViewIcon name={view.icon} className="size-4" />
      <span className="min-w-0 flex-1 truncate">{view.name}</span>
      {active && <Check className="size-4 shrink-0" />}
    </CommandItem>
  );
}
