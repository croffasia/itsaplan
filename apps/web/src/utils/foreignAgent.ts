import type { Assignee } from '@/lib/api/endpoints/projects';

// An 'owner'-scoped agent only receives the runs of the member it belongs to, so
// delegating it to anyone else queues work its runner never picks up.
export function isForeignAgent(a: Assignee, currentUserId: string | null): boolean {
  return a.restrictedToUserId != null && a.restrictedToUserId !== currentUserId;
}
