import { useState } from 'react';
import { type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import type { IssuePatch } from '@/lib/api';
import { useUpdateIssue } from '@/services/issues.service';
import { useDndSensors } from '@/lib/dnd';
import { type DropData } from '../utils/dnd';

// Drag-and-drop state and helpers shared by the two board layouts (the flat
// column board and the swimlane grid). It owns which card is being dragged (for
// the drag overlay) and turns a drop into an issue update. The actual move is
// carried by the drop target's data (see DropData); onDragEnd just invokes it
// with the dragged issue id.
export function useBoardDnd(projectKey: string) {
  const updateIssue = useUpdateIssue(projectKey);
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useDndSensors();

  const move = (issueId: number, patch: IssuePatch) => updateIssue.mutate({ id: issueId, patch });

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const onDragCancel = () => setActiveId(null);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const data = e.over?.data.current as DropData | undefined;
    data?.onDrop(Number(e.active.id));
  };

  return { sensors, activeId, move, onDragStart, onDragCancel, onDragEnd };
}
