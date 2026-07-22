import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { type Label as LabelRow } from '@/lib/api';
import { colorDot } from '@/components/common/fields/colorDot';
import { SettingsRow } from '../crud/SettingsRow';
import { useSettingsCan } from '../../context/settingsPermission';

// `draggable` means the project has groups to move a label between.
export function SettingsDraggableLabelRow({
  label,
  draggable,
  meta,
  onEdit,
  onDelete,
}: {
  label: LabelRow;
  draggable: boolean;
  meta?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Moving a label between groups is a labels edit; disable dragging and hide the
  // grip without it.
  const canEdit = useSettingsCan()('edit');
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: label.id,
    disabled: !canEdit,
  });
  const handle =
    draggable && canEdit ? (
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        title="Drag to a group"
        aria-label="Drag label"
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
    ) : undefined;
  return (
    <SettingsRow
      className="h-11"
      handle={handle}
      dimmed={isDragging}
      media={colorDot(label.color)}
      title={label.name}
      meta={meta}
      editTitle="Edit label"
      deleteTitle="Delete label"
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
