import { useDndContext } from '@dnd-kit/core';
import { type Issue } from '@/lib/api';
import { type IssueGroup } from '@/utils/project';
import { draggedIds } from '../utils/kanban';
import { countEntering } from '../utils/wipLimit';

// How many of the cards in the current drag would be new to `group`'s column. A
// drag carries the whole selection when the grabbed card is part of it, and some of
// those may already sit in that column — reordering them there, or moving them
// between its swimlanes, adds nothing to it. Zero when nothing is being dragged.
export function useIncomingCount(group: IssueGroup, issues: Issue[]): number {
  const { active } = useDndContext();
  if (!active) return 0;
  return countEntering(draggedIds(active), issues, group);
}
