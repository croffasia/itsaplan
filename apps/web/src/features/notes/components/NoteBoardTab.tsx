import { Globe, Lock, MoreHorizontal, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MruEntry } from '../hooks/useNoteBoardMru';

// One board tab in the notes header; the active one also carries the board menu.
// Making a board private is limited to its creator, which the host resolves into
// canMakePrivate.
export default function NoteBoardTab({
  tab,
  active,
  canMakePrivate,
  onSelect,
  onRename,
  onToggleVisibility,
  onDelete,
}: {
  tab: MruEntry;
  active: boolean;
  canMakePrivate: boolean;
  onSelect: () => void;
  onRename: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const { can } = usePermissions();
  const canEdit = can('note_boards', 'edit');
  const canDelete = can('note_boards', 'delete');
  const showMenu = active && (canEdit || canDelete);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-1.5">
        {tab.personal ? <Lock className="size-3.5" /> : <StickyNote className="size-3.5" />}
        {tab.name}
      </button>

      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Board options"
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {canEdit && (
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="size-4" /> Rename
              </DropdownMenuItem>
            )}
            {canEdit && tab.personal && (
              <DropdownMenuItem onClick={onToggleVisibility}>
                <Globe className="size-4" /> Make public
              </DropdownMenuItem>
            )}
            {canEdit && !tab.personal && canMakePrivate && (
              <DropdownMenuItem onClick={onToggleVisibility}>
                <Lock className="size-4" /> Make private
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
