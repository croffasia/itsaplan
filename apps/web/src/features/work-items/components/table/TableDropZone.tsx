import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

// A droppable section wrapper (group / sub-group header), highlighted while a
// drag is over it.
export function TableDropZone({
  id,
  onDrop,
  disabled,
  className,
  children,
}: {
  id: string;
  onDrop: (issueId: number) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { onDrop }, disabled });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && !disabled && 'bg-accent/30')}>
      {children}
    </div>
  );
}
