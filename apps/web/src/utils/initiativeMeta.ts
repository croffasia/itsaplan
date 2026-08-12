import type { InitiativeStatus, InitiativeHealth } from '@/lib/api';

// Display metadata for the initiative status lifecycle and the derived health
// signal. Colors are raw hex so they can drive both a dot and a text color. The
// label of a status is a message under `initiatives.status`, of a health signal
// under `initiatives.health`.

export const STATUS_META: Record<InitiativeStatus, { color: string }> = {
  proposed: { color: '#a1a1aa' },
  planned: { color: '#6366f1' },
  active: { color: '#eab308' },
  completed: { color: '#22c55e' },
  canceled: { color: '#ef4444' },
};

// The lifecycle order used by the status picker and the list tabs.
export const STATUS_ORDER: InitiativeStatus[] = [
  'proposed',
  'planned',
  'active',
  'completed',
  'canceled',
];

// Health (computed server-side). null means there is nothing to judge yet, and
// carries the muted color of an unknown value.
export const HEALTH_META: Record<InitiativeHealth, { color: string }> = {
  on_track: { color: '#22c55e' },
  at_risk: { color: '#eab308' },
  off_track: { color: '#ef4444' },
};

export function healthColor(health: InitiativeHealth | null): string {
  return health ? HEALTH_META[health].color : '#a1a1aa';
}
