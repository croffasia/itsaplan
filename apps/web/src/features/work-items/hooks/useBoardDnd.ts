import { useState } from 'react';
import { type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import type { ProjectDetail } from '@/lib/api';
import { useDndSensors } from '@/lib/dnd';
import { draggedIds, type BoardDropData } from '../utils/kanban';
import { useApplyAssign } from './useApplyAssign';

// Drag-and-drop state and helpers shared by the two board layouts (the flat
// column board and the swimlane grid). It owns which card is being dragged (for
// the drag overlay) and turns a drop into issue updates. The actual move is
// carried by the drop target's data (see BoardDropData); onDragEnd just invokes
// it with the dragged issue ids — the card alone, or the whole selection when the
// card is part of it. In a read-only share the board keeps its DndContext but
// gets inert sensors, so no drag can ever start (see useDndSensors).
export function useBoardDnd(project: ProjectDetail, readOnly = false) {
  const move = useApplyAssign(project);
  // The grabbed card and how many issues move with it, for the drag overlay.
  const [active, setActive] = useState<{ id: number; count: number } | null>(null);
  const sensors = useDndSensors(readOnly);

  const onDragStart = (e: DragStartEvent) =>
    setActive({ id: Number(e.active.id), count: draggedIds(e.active).length });
  const onDragCancel = () => setActive(null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const data = e.over?.data.current as BoardDropData | undefined;
    data?.onDrop(draggedIds(e.active));
  };

  return {
    sensors,
    activeId: active?.id ?? null,
    activeCount: active?.count ?? 0,
    move,
    onDragStart,
    onDragCancel,
    onDragEnd,
  };
}
