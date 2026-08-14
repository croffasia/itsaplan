import type { Assignee } from '@/lib/api';

// An 'owner'-scoped agent only receives the runs of the member it belongs to, so
// delegating it to anyone else queues work its runner never picks up.
export function isForeignAgent(a: Assignee, currentUserId: string | null): boolean {
  return a.restrictedToUserId != null && a.restrictedToUserId !== currentUserId;
}

// The agents a picker without room for an explanation should offer.
export function delegatableAgents(assignees: Assignee[], currentUserId: string | null): Assignee[] {
  return assignees.filter((a) => a.kind === 'agent' && !isForeignAgent(a, currentUserId));
}
