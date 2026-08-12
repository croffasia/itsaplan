'use client';

import { useTranslations } from 'next-intl';
import { colorDot } from '@/components/common/fields/colorDot';
import type { CycleGroup } from '../../utils/cycleGroups';
import { CYCLE_GROUP_H } from '../../utils/cycleTimeline';

// A group header row on the timeline: the status and how many cycles it holds, with
// an empty band across the day track.
export default function CycleTimelineGroupRow({
  group,
  labelW,
  trackWidth,
}: {
  group: CycleGroup;
  labelW: number;
  trackWidth: number;
}) {
  const t = useTranslations('cycles');

  return (
    <div className="flex border-b bg-muted/40" style={{ height: CYCLE_GROUP_H }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-muted px-3 text-sm font-medium"
        style={{ width: labelW }}
      >
        {colorDot(group.color)}
        <span className="truncate">{t(`status.${group.status}`)}</span>
        <span className="text-muted-foreground">{group.cycles.length}</span>
      </div>
      <div style={{ width: trackWidth }} />
    </div>
  );
}
