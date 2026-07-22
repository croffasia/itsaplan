import { FolderPlus, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function SettingsLabelsAddMenu({
  disabled,
  onAddLabel,
  onAddGroup,
}: {
  disabled: boolean;
  onAddLabel: () => void;
  onAddGroup: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onClick={onAddLabel}>
          <Tag className="size-4" />
          New label
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddGroup}>
          <FolderPlus className="size-4" />
          New group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
