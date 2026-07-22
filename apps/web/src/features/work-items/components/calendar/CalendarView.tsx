import { useState } from 'react';
import { isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { type Issue } from '@/lib/api';
import { buildMaps, issueColor, type WorkItemsViewProps } from '@/utils/project';
import { toDateStr } from '@/utils/dates';
import { useDndSensors } from '@/lib/dnd';
import { useUpdateIssue } from '@/services/issues.service';
import { buildCalendarModel } from '../../utils/calendar';
import { CalendarMonthNav } from './CalendarMonthNav';
import { CalendarDayCell } from './CalendarDayCell';
import { CalendarUnscheduledPanel, UNSCHEDULED_ID } from './CalendarUnscheduledPanel';

export default function CalendarView({ project, settings, onOpenIssue }: WorkItemsViewProps) {
  const updateIssue = useUpdateIssue(project.project.key);
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useDndSensors();

  const dateField = settings.calendarDateField;
  const today = new Date();
  const maps = buildMaps(project);
  const dot = (issue: Issue) => issueColor(issue, maps);

  const { byDay, unscheduled, weekdays, days } = buildCalendarModel(
    project.issues,
    dateField,
    settings.weekStart,
    cursor,
  );

  function reschedule(issueId: number, value: string | null) {
    updateIssue.mutate({ id: issueId, patch: { [dateField]: value } });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const issueId = Number(active.id);
    if (over.id === UNSCHEDULED_ID) reschedule(issueId, null);
    else if (typeof over.id === 'string' && over.id.startsWith('day:'))
      reschedule(issueId, over.id.slice(4));
  }

  const activeIssue =
    activeId != null ? (project.issues.find((i) => i.id === activeId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveId(Number(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-4">
          <CalendarMonthNav cursor={cursor} onCursorChange={setCursor} />

          <div className="grid grid-cols-7 border-b pb-1 text-xs font-medium text-muted-foreground">
            {weekdays.map((d) => (
              <div key={d} className="truncate px-0.5 text-center sm:px-2 sm:text-left">
                {d}
              </div>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-b-md border-x border-b">
            {days.map((day) => {
              const key = toDateStr(day);
              return (
                <CalendarDayCell
                  key={key}
                  project={project}
                  dateKey={key}
                  dayNumber={day.getDate()}
                  inMonth={isSameMonth(day, cursor)}
                  isToday={isSameDay(day, today)}
                  issues={byDay.get(key) ?? []}
                  dot={dot}
                  onOpen={onOpenIssue}
                />
              );
            })}
          </div>
        </div>

        <CalendarUnscheduledPanel
          project={project}
          dateField={dateField}
          issues={unscheduled}
          dot={dot}
          onOpen={onOpenIssue}
        />
      </div>

      {/* dropAnimation disabled: the move is applied optimistically, so animating
          the overlay back to its source cell first makes it look like it snaps
          back before reappearing on the new day. */}
      <DragOverlay dropAnimation={null}>
        {activeIssue ? (
          <div className="flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-xs shadow-md">
            <span
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: dot(activeIssue) }}
            />
            <span className="truncate text-foreground">{activeIssue.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
