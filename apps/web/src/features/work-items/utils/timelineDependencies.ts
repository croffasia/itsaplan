import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { Maps } from '@/utils/project';

// How far an arrow runs out of the blocking bar before it turns, and how far it
// comes in before the blocked one.
const STUB = 8;

// The orthogonal path from the end of the blocking bar to the start of the
// blocked one. When the blocked bar starts before the blocker ends, the arrow
// steps back between the two rows instead of crossing the bars.
export function dependencyPath(
  from: { right: number; midY: number },
  to: { left: number; midY: number },
): string {
  const startX = from.right;
  const endX = to.left;
  if (endX - startX >= STUB * 2) {
    const midX = startX + STUB;
    return `M${startX},${from.midY} H${midX} V${to.midY} H${endX}`;
  }
  const between = (from.midY + to.midY) / 2;
  return `M${startX},${from.midY} H${startX + STUB} V${between} H${endX - STUB} V${to.midY} H${endX}`;
}

// An issue the plan treats as a milestone: one labelled "Milestone" (any case), as an
// MS Project import labels them. The timeline draws it as a diamond on its due date.
export function isMilestone(issue: Pick<BoardIssue, 'labelIds'>, maps: Pick<Maps, 'labelById'>) {
  return issue.labelIds.some(
    (id) => maps.labelById.get(id)?.name.trim().toLowerCase() === 'milestone',
  );
}
