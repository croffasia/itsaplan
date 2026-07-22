import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { View } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ViewTabChrome from '@/components/layout/ViewTabChrome';
import ViewTabLabel from '@/components/layout/ViewTabLabel';

// A saved view tab. Sortable (drag to reorder); when active it shows a "…" menu
// with Edit view / Delete.
export default function SavedViewTab({
  view,
  active,
  canEdit,
  canDelete,
  onSelect,
  onEdit,
  onDelete,
}: {
  view: View;
  active: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Reordering views is a views edit; disable dragging without it.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: view.id,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const showMenu = active && (canEdit || canDelete);

  return (
    <ViewTabChrome
      active={active}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(canEdit ? 'cursor-grab' : 'cursor-default', isDragging && 'opacity-40')}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-1.5 py-1 pr-1 pl-2">
        <ViewTabLabel view={view} />
      </button>
      {showMenu ? (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="View options"
              className="mr-1.5 rounded p-0.5 hover:bg-accent-foreground/10"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-40 p-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
              >
                <Pencil className="size-3.5" /> Edit view
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="w-1.5" />
      )}
    </ViewTabChrome>
  );
}
