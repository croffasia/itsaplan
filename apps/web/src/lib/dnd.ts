import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useEffect, useState, type SyntheticEvent } from 'react';

// How far the pointer must move before a press becomes a drag. Also the threshold
// a draggable uses to tell a click apart from the click the browser fires after a
// drag ends.
export const DRAG_ACTIVATION_DISTANCE = 4;

// Shared drag sensors for every dnd-kit surface. A mouse drag starts after a
// small move, so a click on a draggable still registers as a click. A touch drag
// starts after a press-and-hold, so a swipe scrolls the list or strip under it;
// draggables must not set `touch-none` for that. Drag is turned off on phones
// per-draggable via `useDraggable({ disabled })` (see useIsPhone), not by
// dropping sensors here — dnd-kit puts the sensors in a useEffect dependency
// array and warns if its length changes between renders.
//
// `inert` returns empty sensors so no drag can ever start, used by a read-only
// share: the board keeps its DndContext (cards call useDraggable/useDroppable and
// need the ancestor), but nothing is draggable. `inert` is fixed per component
// instance, so the sensor-array length still never changes between its renders.
export function useDndSensors(inert = false) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const inertSensors = useSensors();
  return inert ? inertSensors : sensors;
}

// A sortable list's order from a drop until the reordered data reaches the list. A query
// cache tells React a task after the drop, and by then a DragOverlay has measured the
// dragged item in its old slot and flies back there before the list moves. Call drop in
// onDragEnd with every id in the new order, so the list moves in the same render.
export function useDroppedOrder<T extends { id: number }>(items: T[]) {
  const [dropped, setDropped] = useState<{ from: string; ids: number[] } | null>(null);
  const key = items.map((item) => item.id).join();
  useEffect(() => setDropped(null), [key]);
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    items: dropped?.from === key ? dropped.ids.flatMap((id) => byId.get(id) ?? []) : items,
    drop: (ids: number[]) => setDropped({ from: key, ids }),
  };
}

const stopPropagation = (e: SyntheticEvent) => e.stopPropagation();

// Spread on a control inside a draggable so pressing it does not start a drag of
// the draggable. pointerdown is stopped too: a board card records where a press
// started on it.
export const noDragProps = {
  onMouseDown: stopPropagation,
  onTouchStart: stopPropagation,
  onPointerDown: stopPropagation,
};
