import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LayoutDashboard, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Dashboard } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function DashboardTab({
  dashboard,
  active,
  canEdit,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: {
  dashboard: Dashboard;
  active: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Reordering tabs is a dashboards edit; disable dragging without it.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dashboard.id,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  // The options menu holds rename (edit) and delete; hide it when neither is allowed.
  const showMenu = active && (canEdit || canDelete);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex shrink-0 items-center rounded-md text-sm transition-colors',
        canEdit ? 'cursor-grab' : 'cursor-default',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        isDragging && 'opacity-40',
      )}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-1.5 py-1 pr-1 pl-2">
        <LayoutDashboard className="size-3.5" />
        {dashboard.name}
      </button>
      {showMenu ? (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Dashboard options"
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
                  onRename();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
              >
                <Pencil className="size-3.5" /> Rename
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
    </div>
  );
}
