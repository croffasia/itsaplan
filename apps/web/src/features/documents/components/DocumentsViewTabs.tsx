'use client';

import { LayoutGrid, ListTree, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentListView } from '../utils/documentList';

const VIEWS: { value: DocumentListView; icon: LucideIcon; label: 'homeView' | 'allPages' }[] = [
  { value: 'home', icon: LayoutGrid, label: 'homeView' },
  { value: 'tree', icon: ListTree, label: 'allPages' },
];

export default function DocumentsViewTabs({
  view,
  onSelect,
}: {
  view: DocumentListView;
  onSelect: (view: DocumentListView) => void;
}) {
  const t = useTranslations('documents');

  return (
    <Tabs value={view}>
      <TabsList className="h-8">
        {VIEWS.map(({ value, icon: Icon, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-1.5 text-[13px]"
            aria-label={t(label)}
            onClick={() => onSelect(value)}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{t(label)}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
