import { useDroppable } from '@dnd-kit/core';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import ViewTabChrome from '@/components/layout/ViewTabChrome';

// Droppable id for the fixed All tab; dropping a view here moves it to the front.
export const ALL_DROP_ID = 'view-all';

// The fixed All tab. It is a drop target so a view dragged onto it moves to the
// front; it highlights while a drag is in progress.
export default function AllViewTab({
  active,
  dragging,
  onClick,
}: {
  active: boolean;
  dragging: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ALL_DROP_ID });
  return (
    <ViewTabChrome
      active={active}
      className={cn(dragging && 'ring-1 ring-primary/40', isOver && 'bg-accent')}
    >
      <button
        ref={setNodeRef}
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 py-1 pr-2 pl-2"
      >
        <Layers className="size-3.5" />
        All
      </button>
    </ViewTabChrome>
  );
}
