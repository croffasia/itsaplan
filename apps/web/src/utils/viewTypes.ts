import { CalendarDaysIcon } from '@animateicons/react/lucide/calendar-days-icon';
import { ChartGanttIcon } from '@animateicons/react/lucide/chart-gantt-icon';
import { Columns3Icon } from '@animateicons/react/lucide/columns-3-icon';
import { TableIcon } from '@animateicons/react/lucide/table-icon';
import type { AnimatedIcon } from '@/lib/animatedIcon';
import type { HotkeyId } from '@/utils/hotkeys';

// Shared view-domain types used by both project.ts (sorting) and viewSettings.ts
// (stored settings). Kept in their own module so those two do not import each
// other's types in a cycle.

// Global ordering preference (see App). 'manual' keeps the drag-and-drop order
// the API returns (by position); every other field sorts client-side. Applied
// by the list-like views (Kanban, Table); the date-laid-out Timeline and Calendar
// ignore it.
export type SortField =
  | 'manual'
  | 'title'
  | 'identifier'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'type'
  | 'startDate'
  | 'dueDate'
  | 'created'
  | 'updated';

export interface Sort {
  field: SortField;
  dir: 'asc' | 'desc';
}

// The project's four display modes. Which mode is active is a global preference
// (see App); each mode's settings are stored per project (see viewSettings).
export type WorkItemsView = 'kanban' | 'table' | 'timeline' | 'calendar';

// Each layout names its hotkey id rather than a key, so the switcher, the global
// key layer and the command palette all read the same binding (see lib/hotkeys).
// The name of a layout is a message under `display.layouts`.
export const VIEWS: { value: WorkItemsView; icon: AnimatedIcon; hotkey: HotkeyId }[] = [
  { value: 'kanban', icon: Columns3Icon, hotkey: 'view.kanban' },
  { value: 'table', icon: TableIcon, hotkey: 'view.table' },
  { value: 'timeline', icon: ChartGanttIcon, hotkey: 'view.timeline' },
  { value: 'calendar', icon: CalendarDaysIcon, hotkey: 'view.calendar' },
];

// Fields the project can be ordered by, in the order shown in the menu. The name
// of a field is a message under `display.sortFields`.
export const SORT_FIELDS: SortField[] = [
  'manual',
  'title',
  'identifier',
  'status',
  'priority',
  'assignee',
  'type',
  'startDate',
  'dueDate',
  'created',
  'updated',
];
