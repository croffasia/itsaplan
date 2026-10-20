import type { Assignee } from '@/lib/api/endpoints/projects';
import { isForeignAgent } from '@/utils/foreignAgent';

// The agents a picker without room for an explanation should offer.
export function delegatableAgents(assignees: Assignee[], currentUserId: string | null): Assignee[] {
  return assignees.filter((a) => a.kind === 'agent' && !isForeignAgent(a, currentUserId));
}
