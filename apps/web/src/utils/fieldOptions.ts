// Canonical value lists for the fixed issue fields (priority and state type), so
// every place that needs their values or order reads them from here instead of
// keeping its own copy. Adding a priority/state is a single edit in this file
// (plus its icon in the two icon renderers and its message).

import type { CycleStatus, InitiativeStatus, StateType } from '@/lib/api';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';

// Priority values in display/rank order (most urgent first). The filter options,
// sort rank, group order and the field selector all derive from this list; the
// label of a value is a message under `common.priority` (see usePriorityLabel).
export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];

// value -> rank (0 = most urgent). An unset priority is absent, so callers rank
// it after every listed one.
export const PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  PRIORITY_ORDER.map((value, i) => [value, i]),
);

// Filter-builder values: the priorities plus an explicit "unset" choice (null).
export const PRIORITY_FILTER_VALUES: (Priority | null)[] = [...PRIORITY_ORDER, null];

// The cycle and initiative statuses a filter can name instead of one of them by
// id, so a saved view follows the cycles as they roll over and the initiatives as
// they start. The closed ones are left out: they are picked by name, and a filter
// on "completed" would keep growing. Their labels are messages under
// `filters.cycleStatus` / `filters.initiativeStatus`.
export const CYCLE_FILTER_STATUSES: CycleStatus[] = ['active', 'upcoming'];

export const INITIATIVE_FILTER_STATUSES: InitiativeStatus[] = ['active', 'planned', 'proposed'];

// State types in workflow order. The label of a state type is a message under
// `display.stateTypes`.
export const STATE_TYPES: StateType[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
];
