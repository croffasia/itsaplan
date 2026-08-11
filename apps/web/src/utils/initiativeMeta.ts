import type { InitiativeStatus, InitiativeHealth } from '@/lib/api';

// Display metadata for the initiative status lifecycle and the derived health
// signal. Colors are raw hex so they can drive both a dot and a text color.

export const STATUS_META: Record<InitiativeStatus, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: '#a1a1aa' },
  planned: { label: 'Planned', color: '#6366f1' },
  active: { label: 'Active', color: '#eab308' },
  completed: { label: 'Completed', color: '#22c55e' },
  canceled: { label: 'Canceled', color: '#ef4444' },
};

// The lifecycle order used by the status picker and the list tabs.
export const STATUS_ORDER: InitiativeStatus[] = [
  'proposed',
  'planned',
  'active',
  'completed',
  'canceled',
];

// Health (computed server-side). null means there is nothing to judge yet.
export const HEALTH_META: Record<InitiativeHealth, { label: string; color: string }> = {
  on_track: { label: 'On track', color: '#22c55e' },
  at_risk: { label: 'At risk', color: '#eab308' },
  off_track: { label: 'Off track', color: '#ef4444' },
};

export function healthMeta(health: InitiativeHealth | null): { label: string; color: string } {
  return health ? HEALTH_META[health] : { label: 'No update', color: '#a1a1aa' };
}
