// Canonical option lists for the fixed issue fields (priority and state type),
// so every place that needs their values, labels or order reads them from here
// instead of keeping its own copy. Adding or renaming a priority/state is a
// single edit in this file (plus its icon in the two icon renderers).

import type { StateType } from '@/lib/api';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';

// Priorities most-urgent-first. The filter options, sort rank, group order and
// the field selector all derive from this list.
export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// Priority values in display/rank order (most urgent first).
export const PRIORITY_ORDER = PRIORITIES.map((p) => p.value);

// value -> rank (0 = most urgent). An unset priority is absent, so callers rank
// it after every listed one.
export const PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p.value, i]),
);

// The label for a priority value, or "No priority" for an unset one.
export const priorityLabel = (value: string | null | undefined): string =>
  PRIORITIES.find((p) => p.value === value)?.label ?? 'No priority';

// Filter-builder options: the priorities plus an explicit "unset" choice (null).
export const PRIORITY_OPTIONS: { value: string | null; label: string }[] = [
  ...PRIORITIES,
  { value: null, label: 'No priority' },
];

// State types in workflow order.
export const STATE_TYPES: StateType[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
];

const STATE_TYPE_LABELS: Record<StateType, string> = {
  backlog: 'Backlog',
  unstarted: 'Unstarted',
  started: 'Started',
  completed: 'Completed',
  canceled: 'Canceled',
};

// Filter-builder options for the state type field, in workflow order.
export const STATE_TYPE_OPTIONS: { value: StateType; label: string }[] = STATE_TYPES.map(
  (value) => ({
    value,
    label: STATE_TYPE_LABELS[value],
  }),
);
