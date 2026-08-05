import type { Cycle } from '@/lib/api';
import { buildDayTrack, type DayTrack } from '@/utils/timelineTrack';
import { cycleSpan, type CycleSpan } from './cycleDates';
import { groupCycles, type CycleGroup } from './cycleGroups';

export const CYCLE_DAY_W = 12; // px per day: a two-week cycle is a legible bar
export const CYCLE_ROW_H = 40;
export const CYCLE_GROUP_H = 30;

// The dragged label-column width is a client-only preference, kept per project.
export function cycleLabelWidthKey(projectKey: string): string {
  return `cycles-timeline-label-width:${projectKey}`;
}

// One entry per group header, then its cycles, so the sticky labels and the day
// track share the same row order.
export type CycleTimelineItem =
  { kind: 'group'; group: CycleGroup } | { kind: 'cycle'; cycle: Cycle; span: CycleSpan };

export interface CycleTimelineModel extends DayTrack {
  rows: CycleTimelineItem[];
}

export function buildCycleTimeline({
  cycles,
  viewportW,
  labelW,
  dayW,
}: {
  cycles: Cycle[];
  viewportW: number;
  labelW: number;
  dayW: number;
}): CycleTimelineModel {
  const rows: CycleTimelineItem[] = [];
  let min: Date | null = null;
  let max: Date | null = null;
  for (const group of groupCycles(cycles)) {
    rows.push({ kind: 'group', group });
    for (const cycle of group.cycles) {
      const span = cycleSpan(cycle);
      if (!span) continue;
      if (!min || span.start < min) min = span.start;
      if (!max || span.end > max) max = span.end;
      rows.push({ kind: 'cycle', cycle, span });
    }
  }

  return { rows, ...buildDayTrack({ min, max, viewportW, labelW, dayW }) };
}
