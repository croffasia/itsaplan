import type { InitiativeCounts, InitiativeStatus } from '@/lib/api';
import type { InitiativesTab } from '@/utils/paths';

// One tab per lifecycle status, except the terminal statuses share a "Completed"
// tab. `statuses: undefined` means the tab takes every status. The array order is
// the default tab order; a user can reorder the strip by drag (see
// useInitiativeTabOrder).
export const INITIATIVE_TABS: {
  value: InitiativesTab;
  label: string;
  statuses: InitiativeStatus[] | undefined;
}[] = [
  { value: 'active', label: 'Active', statuses: ['active'] },
  { value: 'planned', label: 'Planned', statuses: ['planned'] },
  { value: 'proposed', label: 'Proposed', statuses: ['proposed'] },
  { value: 'completed', label: 'Completed', statuses: ['completed', 'canceled'] },
  { value: 'all', label: 'All initiatives', statuses: undefined },
];

// The "Completed" tab groups the two terminal statuses, so its count sums them.
export function tabCount(
  counts: InitiativeCounts | undefined,
  tab: InitiativesTab,
): number | undefined {
  if (!counts) return undefined;
  switch (tab) {
    case 'all':
      return counts.total;
    case 'proposed':
      return counts.proposed;
    case 'planned':
      return counts.planned;
    case 'active':
      return counts.active;
    case 'completed':
      return counts.completed + counts.canceled;
  }
}
