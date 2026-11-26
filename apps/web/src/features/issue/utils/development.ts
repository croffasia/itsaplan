import type { DevelopmentLink } from '@/lib/api/endpoints/git';

export type DevelopmentLinkState = 'branch' | 'draft' | 'merged' | 'closed' | 'open';

// Where a linked branch or pull request stands, for its icon and its label. Whether
// the checks passed is shown on its own, next to this.
export function developmentLinkState(link: DevelopmentLink): DevelopmentLinkState {
  if (link.kind === 'branch') return 'branch';
  if (link.draft) return 'draft';
  if (link.state === 'merged') return 'merged';
  if (link.state === 'closed') return 'closed';
  return 'open';
}
