import { GanttChart, Table2, type LucideIcon } from 'lucide-react';
import type { CyclesView } from '@/utils/paths';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS: { value: CyclesView; label: string; icon: LucideIcon }[] = [
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'timeline', label: 'Timeline', icon: GanttChart },
];

// The cycles list layout switcher: the grouped table or the day track. The open
// layout comes from the route, so Radix drives no selection of its own and each
// trigger navigates on click.
export default function CyclesViewTabs({
  view,
  onSelect,
}: {
  view: CyclesView;
  onSelect: (view: CyclesView) => void;
}) {
  return (
    <Tabs value={view}>
      <TabsList variant="line" className="overflow-x-auto">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="shrink-0 gap-1.5"
            onClick={() => onSelect(value)}
          >
            <Icon className="size-3.5" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
