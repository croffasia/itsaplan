import { useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { WeekStart } from '@/utils/viewSettings';
import { dayInWeek, parseDropId, UNSCHEDULED_ID } from '../utils/calendar';
import type { useCalendarSchedule } from './useCalendarSchedule';

export function useCalendarDrop({
  project,
  schedule,
  weekStart,
}: {
  project: ProjectDetail;
  schedule: ReturnType<typeof useCalendarSchedule>;
  weekStart: WeekStart;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const find = (id: number | null): Issue | null =>
    id == null ? null : (project.issues.find((i) => i.id === id) ?? null);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    const issue = find(Number(active.id));
    if (!over || !issue) return;
    if (over.id === UNSCHEDULED_ID) return schedule.reschedule(issue, null);
    const drop = parseDropId(over.id);
    if (drop?.kind === 'day') schedule.reschedule(issue, drop.date);
    else if (drop?.kind === 'week')
      schedule.reschedule(issue, dayInWeek(schedule.dayOf(issue), drop.date, weekStart));
  }

  return {
    activeIssue: find(activeId),
    onDragStart: (e: DragStartEvent) => setActiveId(Number(e.active.id)),
    onDragCancel: () => setActiveId(null),
    onDragEnd,
  };
}
