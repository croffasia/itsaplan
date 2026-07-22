import { useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { type Column, type ProjectDetail, type StateType } from '@/lib/api';
import { useDndSensors } from '@/lib/dnd';
import { STATE_TYPES } from '@/utils/fieldOptions';
import { DEFAULT_COLOR } from '@/utils/project';
import { Button } from '@/components/ui/button';
import { ItemGroup } from '@/components/ui/item';
import SettingsColorField from '../crud/SettingsColorField';
import { SettingsEmpty } from '../crud/SettingsEmpty';
import { SettingsInlineEditForm } from '../crud/SettingsInlineEditForm';
import { useSettingsCan } from '../../context/settingsPermission';
import {
  useCreateColumn,
  useReorderColumns,
  useUpdateColumn,
} from '../../services/settings.service';
import { SettingsStateRow } from './SettingsStateRow';
import SettingsDeleteStateDialog from './SettingsDeleteStateDialog';

// The workflow states, grouped by state type. Each group has its own inline add;
// states are reordered within their group by drag, edited inline, and deleted.
export default function SettingsStates({ project }: { project: ProjectDetail }) {
  const [addingType, setAddingType] = useState<StateType | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [deleting, setDeleting] = useState<Column | null>(null);
  const sensors = useDndSensors();
  const can = useSettingsCan();
  const createColumn = useCreateColumn(project.project.key);
  const updateColumn = useUpdateColumn(project.project.key);
  const reorderColumns = useReorderColumns(project.project.key);

  const issueCount = (columnId: number) =>
    project.issues.filter((t) => t.columnId === columnId).length;

  // Drop resolves to a reorder within the dragged column's own state type;
  // dropping onto a column of another type is ignored.
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const dragged = project.columns.find((c) => c.id === Number(active.id));
    const target = project.columns.find((c) => c.id === Number(over.id));
    if (!dragged || !target || dragged.stateType !== target.stateType) return;
    void reorderWithinGroup(dragged.id, target.id, dragged.stateType);
  }

  // Moves the dragged column before the drop target within the same state type,
  // then sends the full project column order so the backend renumbers positions.
  async function reorderWithinGroup(draggedId: number, targetId: number, stateType: StateType) {
    const group = project.columns.filter((c) => c.stateType === stateType);
    const from = group.findIndex((c) => c.id === draggedId);
    const to = group.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...group];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const orderedIds = STATE_TYPES.flatMap((s) =>
      (s === stateType ? next : project.columns.filter((c) => c.stateType === s)).map((c) => c.id),
    );
    await reorderColumns.mutateAsync(orderedIds);
  }

  function startAdd(s: StateType) {
    setEditingId(null);
    setAddingType(s);
    setName('');
    setColor(DEFAULT_COLOR);
  }

  async function add(stateType: StateType) {
    if (!name.trim()) return;
    await createColumn.mutateAsync({ name: name.trim(), stateType, color });
    setName('');
    setAddingType(null);
  }

  function startEdit(c: Column) {
    setAddingType(null);
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
  }

  async function saveEdit(c: Column) {
    if (!editName.trim()) return;
    await updateColumn.mutateAsync({
      id: c.id,
      patch: { name: editName.trim(), color: editColor },
    });
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div>
          {STATE_TYPES.map((s) => {
            const group = project.columns.filter((c) => c.stateType === s);
            return (
              <div key={s} className="mb-8 last:mb-0">
                <div className="mb-1 flex items-center justify-between border-b pb-1">
                  <span className="text-xs font-medium text-muted-foreground capitalize">{s}</span>
                  {can('create') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-2 h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      title={`Add ${s} state`}
                      onClick={() => startAdd(s)}
                    >
                      <Plus className="size-3.5" />
                      New
                    </Button>
                  )}
                </div>
                <ItemGroup>
                  {group.length === 0 && addingType !== s && (
                    <SettingsEmpty
                      title={`No ${s} states`}
                      description="Add a workflow state for this group."
                      addLabel="New state"
                      onAdd={() => startAdd(s)}
                    />
                  )}
                  <SortableContext
                    items={group.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {group.map((c) =>
                      editingId === c.id ? (
                        <SettingsInlineEditForm
                          key={c.id}
                          name={editName}
                          onNameChange={setEditName}
                          placeholder="State name"
                          submitLabel="Save"
                          onSubmit={() => void saveEdit(c)}
                          onCancel={() => setEditingId(null)}
                          leading={<SettingsColorField value={editColor} onChange={setEditColor} />}
                        />
                      ) : (
                        <SettingsStateRow
                          key={c.id}
                          column={c}
                          onEdit={() => startEdit(c)}
                          onDelete={() => setDeleting(c)}
                        />
                      ),
                    )}
                  </SortableContext>
                  {addingType === s && (
                    <SettingsInlineEditForm
                      name={name}
                      onNameChange={setName}
                      placeholder="State name"
                      submitLabel="Add"
                      onSubmit={() => void add(s)}
                      onCancel={() => setAddingType(null)}
                      leading={<SettingsColorField value={color} onChange={setColor} />}
                    />
                  )}
                </ItemGroup>
              </div>
            );
          })}
        </div>
      </DndContext>
      {deleting && (
        <SettingsDeleteStateDialog
          project={project}
          column={deleting}
          issueCount={issueCount(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
