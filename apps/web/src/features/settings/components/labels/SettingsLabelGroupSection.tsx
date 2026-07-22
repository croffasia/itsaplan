import type { ReactNode } from 'react';
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { type LabelGroup } from '@/lib/api';
import { cn } from '@/lib/utils';
import { colorDot } from '@/components/common/fields/colorDot';
import { Button } from '@/components/ui/button';
import { useSettingsCan } from '../../context/settingsPermission';

// One section of the labels list. A group renders a collapsible header with its
// labels; the ungrouped bucket is `headerless` and renders its labels directly at
// the root. The whole section is a drop target, so a label dragged onto it (header
// included, even when collapsed) moves into this group — or, for the headerless
// root, out of any group. While a drag is in progress every section shows a dashed
// candidate outline; the one under the cursor gets a solid primary outline and a
// tinted fill.
export function SettingsLabelGroupSection({
  group,
  count,
  empty,
  dragging,
  open,
  headerless,
  editForm,
  onToggle,
  onAddLabel,
  onEditGroup,
  onDeleteGroup,
  children,
}: {
  group: LabelGroup | null;
  count: number;
  empty: boolean;
  dragging: boolean;
  open: boolean;
  headerless?: boolean;
  editForm?: ReactNode;
  onToggle: () => void;
  onAddLabel: () => void;
  onEditGroup?: () => void;
  onDeleteGroup?: () => void;
  children: ReactNode;
}) {
  const can = useSettingsCan();
  const { setNodeRef, isOver } = useDroppable({
    id: group ? `group:${group.id}` : 'ungrouped',
    data: { groupId: group?.id ?? null },
  });
  const name = group?.name ?? 'Ungrouped';
  const wrapperClass = cn(
    'rounded-lg transition-colors',
    dragging && 'outline-1 -outline-offset-2 outline-border/60 outline-dashed',
    isOver && 'bg-primary/10 outline-2 outline-primary outline-solid',
  );

  // The ungrouped root: no header, always open, and its drop hint only appears
  // while dragging (empty root shows nothing at rest).
  if (headerless) {
    if (empty && !dragging) return null;
    return (
      <div ref={setNodeRef} className={wrapperClass}>
        <div className="pb-1">
          {children}
          {empty && (
            <p
              className={cn(
                'py-3 pl-9 text-xs',
                isOver ? 'text-primary' : 'text-muted-foreground/70',
              )}
            >
              Drop a label here to remove it from its group
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className={wrapperClass}>
      {editForm ? (
        <div className="py-1">{editForm}</div>
      ) : (
        <div className="group/gh flex h-11 items-center gap-1 rounded-md pr-2 transition-colors hover:bg-accent/50">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left outline-none"
          >
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-90',
              )}
            />
            {group ? colorDot(group.color) : null}
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {name}
            </span>
            {count > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
            )}
            {isOver && <span className="ml-2 text-xs font-medium text-primary">Drop here</span>}
          </button>
          {onEditGroup && can('edit') && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground opacity-0 group-hover/gh:opacity-100 hover:text-foreground"
              title="Edit group"
              onClick={onEditGroup}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {onDeleteGroup && can('delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground opacity-0 group-hover/gh:opacity-100 hover:text-destructive"
              title="Delete group"
              onClick={onDeleteGroup}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          {can('create') && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Add label"
              aria-label={`Add label to ${name}`}
              onClick={onAddLabel}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      )}

      {open && (
        <div className="pb-1">
          {/* Indent the group's labels so they read as children of the group header. */}
          <div className="pl-6">{children}</div>
          {empty && (
            <p
              className={cn(
                'py-3 pl-9 text-xs',
                isOver ? 'text-primary' : 'text-muted-foreground/70',
              )}
            >
              {dragging ? `Drop a label here to add it to ${name}` : 'No labels'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
