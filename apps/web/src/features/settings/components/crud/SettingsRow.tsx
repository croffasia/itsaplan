import type { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { useSettingsCan } from '../../context/settingsPermission';

// `dimmed` fades the row while it is the drag source. Shared by the settings CRUD tabs.
export function SettingsRow({
  handle,
  dimmed,
  media,
  title,
  meta,
  editTitle,
  deleteTitle,
  onEdit,
  onDelete,
  className,
}: {
  handle?: ReactNode;
  dimmed?: boolean;
  media?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  editTitle: string;
  deleteTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const can = useSettingsCan();
  return (
    <Item
      size="sm"
      className={cn('h-10 border-0 py-0 hover:bg-accent/50', dimmed && 'opacity-40', className)}
    >
      {handle}
      {media != null && <ItemMedia>{media}</ItemMedia>}
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
      </ItemContent>
      {meta != null && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{meta}</span>
      )}
      <ItemActions className="opacity-0 group-hover/item:opacity-100">
        {can('edit') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            title={editTitle}
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
        )}
        {can('delete') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            title={deleteTitle}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
