import { useState } from 'react';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import type { Issue } from '@/lib/api/endpoints/issues';
import { buildMaps, issueColor, type WorkItemsViewProps } from '@/utils/project';
import { useDndSensors } from '@/lib/dnd';
import { usePermissions } from '@/hooks/usePermissions';
import { bucketByDay, isFullWeek, visibleDays } from '../../utils/calendar';
import { useCalendarDrop } from '../../hooks/useCalendarDrop';
import { useCalendarSchedule } from '../../hooks/useCalendarSchedule';
import { CalendarNav } from './CalendarNav';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { CalendarDayGrid } from './CalendarDayGrid';
import { CalendarWeekGrid } from './CalendarWeekGrid';
import { CalendarUnscheduledPanel } from './CalendarUnscheduledPanel';
import { CalendarUnscheduledStrip } from './CalendarUnscheduledStrip';

// Sunday first, the order of Date.getDay().
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function CalendarView({
  project,
  settings,
  onSettingsChange,
  onOpenIssue,
  newIssueDefaults,
  readOnly,
}: WorkItemsViewProps) {
  const t = useTranslations('workItems.calendar');
  const { can } = usePermissions();
  // Any day of the visible month, the first visible day, or any day of the first
  // visible week.
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const sensors = useDndSensors(readOnly);
  const schedule = useCalendarSchedule({
    project,
    dateField: settings.calendarDateField,
    newIssueDefaults,
  });
  const { activeIssue, ...dragHandlers } = useCalendarDrop({
    project,
    schedule,
    weekStart: settings.weekStart,
  });

  const today = new Date();
  const mode = settings.calendarMode;
  const maps = buildMaps(project);
  const dot = (issue: Issue) => issueColor(issue, maps);
  const weekdayNames = WEEKDAY_KEYS.map((key) => t(`weekdays.${key}`));
  const { byDay, unscheduled } = bucketByDay(project.issues, schedule.dayOf);
  const days = visibleDays(cursor, settings);
  const grid = {
    project,
    today,
    days,
    byDay,
    dot,
    onOpen: onOpenIssue,
    onQuickAdd: !readOnly && can('work_items', 'create') ? schedule.create : undefined,
  };

  const setUnscheduledCollapsed = (calendarUnscheduledCollapsed: boolean) =>
    onSettingsChange({ ...settings, calendarUnscheduledCollapsed });

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} {...dragHandlers}>
      {/* The unscheduled panel comes first: at the start on a wide screen, under
          the calendar on a phone. */}
      <div className="flex h-full flex-col-reverse sm:flex-row">
        {!readOnly && settings.calendarUnscheduledCollapsed ? (
          <CalendarUnscheduledStrip
            dateField={settings.calendarDateField}
            count={unscheduled.length}
            onExpand={() => setUnscheduledCollapsed(false)}
          />
        ) : (
          <CalendarUnscheduledPanel
            project={project}
            dateField={settings.calendarDateField}
            issues={unscheduled}
            dot={dot}
            onOpen={onOpenIssue}
            onCollapse={readOnly ? undefined : () => setUnscheduledCollapsed(true)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-4">
          <CalendarNav
            cursor={cursor}
            mode={mode}
            fullWeek={isFullWeek(settings)}
            days={days}
            weekStart={settings.weekStart}
            onCursorChange={setCursor}
          />
          {mode === 'month' && (
            <CalendarMonthGrid {...grid} cursor={cursor} weekdayNames={weekdayNames} />
          )}
          {mode === 'byDay' && <CalendarDayGrid {...grid} weekdayNames={weekdayNames} />}
          {mode === 'byWeek' && (
            <CalendarWeekGrid
              {...grid}
              weekStart={settings.weekStart}
              splitByDay={settings.calendarSplitByDay}
            />
          )}
        </div>
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
