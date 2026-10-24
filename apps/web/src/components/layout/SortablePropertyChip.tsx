import { GripVerticalIcon } from '@animateicons/react/lucide/grip-vertical-icon';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';
import PropertyChip from '@/components/layout/PropertyChip';

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
  // Translate only: the grid strategy also scales a chip to the size of the one it
  // takes the place of, which stretches chips of different widths.
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('flex rounded-full *:cursor-grab', isDragging && 'opacity-40')}
    >
      <PropertyChip
        label={label}
        on
        onClick={onClick}
        icon={GripVerticalIcon}
        iconClassName="text-muted-foreground"
      />
    </span>
  );
}
