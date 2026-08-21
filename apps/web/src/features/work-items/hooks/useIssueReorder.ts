import { useState } from 'react';
import { type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { type Issue, type ProjectDetail } from '@/lib/api';
import { positionsAt, type GroupAssign } from '@/utils/project';
import { useDndSensors } from '@/lib/dnd';
import type { Sort } from '@/utils/viewTypes';
import { useApplyAssign } from './useApplyAssign';
import { useSortedOrderMessage } from './useSortedOrderMessage';
import { preferPrefix, type DropData } from '../utils/dnd';

const rowCollision = preferPrefix('row:');

// Dragging an issue row moves it between sections and reorders it inside one, in
// the table and on the timeline: the same dnd-kit wiring on both, since the drop
// targets carry the move to apply. The timeline bars keep their own pointer drag
// for the dates (useTimelineDrag).
//
// Reordering inside a section only holds when the view is ordered manually: with
// any other sort field the row snaps back to where the sort puts it. A drop that
// would only reorder is refused and explained; a drop into another section still
// goes through, since it changes the grouping field rather than the order.
export function useIssueReorder({
  project,
  sort,
  readOnly,
}: {
  project: ProjectDetail;
  sort: Sort;
  // In a read-only share nothing is draggable.
  readOnly?: boolean;
}) {
  const sortedOrderMessage = useSortedOrderMessage();
  const applyAssign = useApplyAssign(project);
  const sensors = useDndSensors(readOnly);
  const [activeId, setActiveId] = useState<number | null>(null);

  function moveIssue(issueId: number, assign: GroupAssign | null, bucket: Issue[], index: number) {
    if (sort.field !== 'manual' && bucket.some((i) => i.id === issueId)) {
      toast.info(sortedOrderMessage(sort.field));
      return;
    }
    const [position] = positionsAt(bucket, index, 1);
    applyAssign(issueId, assign, position);
  }

  return {
    sensors,
    collisionDetection: rowCollision,
    activeIssue: activeId != null ? (project.issues.find((i) => i.id === activeId) ?? null) : null,
    manualOrder: sort.field === 'manual',
    moveIssue,
    onDragStart: (e: DragStartEvent) => setActiveId(Number(e.active.id)),
    onDragCancel: () => setActiveId(null),
    onDragEnd: (e: DragEndEvent) => {
      setActiveId(null);
      const data = e.over?.data.current as DropData | undefined;
      data?.onDrop(Number(e.active.id));
    },
  };
}
