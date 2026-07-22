import { useHotkeyFormatter } from '@/context/useHotkeys';
import { cn } from '@/lib/utils';
import { VIEWS, type WorkItemsView } from '@/utils/viewTypes';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// The layout switcher at the top of the Display settings: one tab per work items
// layout, the active one showing its label. The hotkey is appended to the tooltip
// when the layout has one bound.
export default function DisplayLayoutTabs({
  view,
  onViewChange,
}: {
  view: WorkItemsView;
  onViewChange: (view: WorkItemsView) => void;
}) {
  const hotkey = useHotkeyFormatter();

  return (
    <Tabs value={view} onValueChange={(v) => onViewChange(v as WorkItemsView)}>
      <TabsList className="w-full">
        {VIEWS.map(({ value, label, icon: Icon, hotkey: id }) => (
          <TabsTrigger
            key={value}
            value={value}
            title={hotkey(id) ? `${label} (${hotkey(id)})` : label}
            className={cn('min-w-0 gap-1.5 px-1.5', value === view ? 'flex-1' : 'flex-none')}
          >
            <Icon className="size-3.5" />
            {value === view && <span className="truncate text-xs">{label}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
