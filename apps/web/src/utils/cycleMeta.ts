import type { CycleStatus } from '@/lib/api';

// Display metadata for the cycle status, which the API derives from the dates.
// Colors are raw hex so they can drive both a dot and a text color, like the
// initiative status meta.
export const CYCLE_STATUS_META: Record<CycleStatus, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: '#6366f1' },
  active: { label: 'Active', color: '#eab308' },
  completed: { label: 'Completed', color: '#22c55e' },
};

// The order the list groups cycles in: what is running now, what is next, what is
// behind.
export const CYCLE_STATUS_ORDER: CycleStatus[] = ['active', 'upcoming', 'completed'];
