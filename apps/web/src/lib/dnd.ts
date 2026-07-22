import {
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// How far the pointer must move before a press becomes a drag. Also the threshold
// a draggable uses to tell a click apart from the click the browser fires after a
// drag ends.
export const DRAG_ACTIVATION_DISTANCE = 4;

// Shared drag sensors for every dnd-kit surface in the planner. The pointer
// sensor uses a small activation distance so a click on a draggable element
// still registers as a click (select a tab, open a issue) instead of starting
// a drag; the keyboard sensor adds accessible reordering. Drag is turned off on
// phones per-draggable via `useDraggable({ disabled })` (see useIsPhone), not by
// dropping sensors here — dnd-kit puts the sensors in a useEffect dependency
// array and warns if its length changes between renders.
export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// Sensors for a horizontally-scrollable sortable strip (the view tabs). Mouse
// drags start after a small move; touch requires a short press-and-hold, so a
// quick swipe scrolls the strip natively instead of starting a reorder. Pair
// this with NO `touch-none` on the items so native touch scrolling works.
export function useStripSortSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
