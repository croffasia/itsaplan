import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';

// An enabled, draggable property chip. A drag reorders it (the sensors require a
// small move first, so a plain click still fires onClick to remove it). The drag
// listeners sit on the wrapper, not on the button: the keyboard sensor takes over
// Space/Enter, which the button needs for its own activation.
export default function SortablePropertyChip({
  id,
  label,
  onClick,
}: {
  id: PropertyKey;
  label: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex cursor-grab items-center rounded-full border border-primary bg-primary text-xs text-primary-foreground transition-colors',
        isDragging && 'opacity-40',
      )}
    >
      <button type="button" onClick={onClick} className="px-2 py-0.5">
        {label}
      </button>
    </span>
  );
}
