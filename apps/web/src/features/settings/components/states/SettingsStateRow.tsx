import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Assignee, type Column } from '@/lib/api';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { colorDot } from '@/components/common/fields/colorDot';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSettingsCan } from '../../context/settingsPermission';

// One sortable state row. The whole row is the sortable node; the grip is the
// drag handle so the Edit/Delete buttons stay clickable. A backlog state cannot
// be deleted, so its delete action is hidden.
export function SettingsStateRow({
  column,
  autoAssignee,
  onEdit,
  onDelete,
}: {
  column: Column;
  autoAssignee?: Assignee;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('settings.states');
  const can = useSettingsCan();
  // Reordering is a states edit; disable dragging and hide the grip without it.
  const canEdit = can('edit');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <Item
      ref={setNodeRef}
      style={style}
      size="sm"
      className={cn(
        'h-10 border-0 border-b border-border py-0 last:border-b-0 hover:bg-accent/50',
        isDragging && 'opacity-40',
      )}
    >
      {canEdit ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="-ml-1 cursor-grab touch-none text-muted-foreground/50 group-hover/item:text-muted-foreground"
          title={t('dragToReorder')}
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="-ml-1 size-4" />
      )}
      <ItemMedia>{colorDot(column.color)}</ItemMedia>
      <ItemContent>
        <ItemTitle>{column.name}</ItemTitle>
      </ItemContent>
      {autoAssignee && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <UserPlus className="size-3.5" />
              <Avatar
                name={autoAssignee.name}
                image={autoAssignee.image}
                className="size-4 text-[8px]"
              />
              {autoAssignee.name}
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('autoAssign.rowTitle', { name: autoAssignee.name })}</TooltipContent>
        </Tooltip>
      )}
      {column.wipLimit != null && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {column.wipMode === 'hard'
            ? t('wip.badgeHard', { limit: column.wipLimit })
            : t('wip.badgeSoft', { limit: column.wipLimit })}
        </span>
      )}
      <ItemActions className="opacity-0 group-hover/item:opacity-100">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            title={t('edit')}
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
        )}
        {can('delete') && column.stateType !== 'backlog' && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            title={t('delete')}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
