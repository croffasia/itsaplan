'use client';

import { GanttChart, Table2, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CyclesView } from '@/utils/paths';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS: { value: CyclesView; icon: LucideIcon }[] = [
  { value: 'table', icon: Table2 },
  { value: 'timeline', icon: GanttChart },
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
  const t = useTranslations('cycles.views');

  return (
    <Tabs value={view}>
      <TabsList variant="line" className="overflow-x-auto">
        {TABS.map(({ value, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="shrink-0 gap-1.5"
            onClick={() => onSelect(value)}
          >
            <Icon className="size-3.5" />
            {t(value)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
