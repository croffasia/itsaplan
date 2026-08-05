import { GanttChart, Table2, type LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CyclesView } from '../../hooks/useCyclesView';

const TABS: { value: CyclesView; label: string; icon: LucideIcon }[] = [
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'timeline', label: 'Timeline', icon: GanttChart },
];

// The cycles list layout switcher: the grouped table or the day track.
export default function CyclesViewTabs({
  view,
  onChange,
}: {
  view: CyclesView;
  onChange: (view: CyclesView) => void;
}) {
  return (
    <Tabs value={view} onValueChange={(v) => onChange(v as CyclesView)}>
      <TabsList className="h-8">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} title={label} className="gap-1.5 px-2">
            <Icon className="size-3.5" />
            <span className="text-xs">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
