'use client';

import { useTranslations } from 'next-intl';
import type { Label, LabelGroup } from '@/lib/api/endpoints/labels';
import ProjectTemplateItems from './ProjectTemplateItems';

// The labels of a template under their groups, the ungrouped ones last.
export default function ProjectTemplateLabels({
  labels,
  groups,
}: {
  labels: Label[];
  groups: LabelGroup[];
}) {
  const t = useTranslations('settings.labels');
  const items = (list: Label[]) => list.map((l) => ({ key: l.id, name: l.name, color: l.color }));

  if (groups.length === 0) return <ProjectTemplateItems items={items(labels)} />;

  const sets = [
    ...groups.map((group) => ({
      key: group.id,
      name: group.name,
      labels: labels.filter((l) => l.groupId === group.id),
    })),
    {
      key: 'ungrouped',
      name: t('ungrouped'),
      labels: labels.filter((l) => !groups.some((group) => group.id === l.groupId)),
    },
  ].filter((set) => set.labels.length > 0);

  return (
    <div className="space-y-1.5">
      {sets.map((set) => (
        <div key={set.key} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <span className="truncate text-xs leading-5 text-muted-foreground" dir="auto">
            {set.name}
          </span>
          <ProjectTemplateItems items={items(set.labels)} />
        </div>
      ))}
    </div>
  );
}
