import { Clock, Inbox, ListChecks, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BraindumpDestination, BraindumpEntry } from '@/lib/api';
import { DESTINATION_META } from '../utils/braindump';

export default function BraindumpCardActions({
  entry,
  obsidianAvailable,
  canEdit,
  canDelete,
  onRoute,
  onRename,
  onDelete,
}: {
  entry: BraindumpEntry;
  obsidianAvailable: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRoute: (destination: BraindumpDestination) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  if (!canEdit && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Dump actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {entry.routedTo ? 'File again' : 'File this dump'}
            </DropdownMenuLabel>
            <DropdownMenuItem disabled={!obsidianAvailable} onSelect={() => onRoute('obsidian')}>
              <Inbox className="size-4" />
              {DESTINATION_META.obsidian.label}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRoute('issue')}>
              <ListChecks className="size-4" />
              {DESTINATION_META.issue.label}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRoute('schedule')}>
              <Clock className="size-4" />
              {DESTINATION_META.schedule.label}
            </DropdownMenuItem>
          </>
        )}
        {canEdit && canDelete && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
