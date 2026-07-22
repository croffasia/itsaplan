import { useState } from 'react';
import { DndContext, DragOverlay, type DragEndEvent } from '@dnd-kit/core';
import { type Label as LabelRow, type LabelGroup, type ProjectDetail } from '@/lib/api';
import { useDndSensors } from '@/lib/dnd';
import { DEFAULT_COLOR } from '@/utils/project';
import { colorDot } from '@/components/common/fields/colorDot';
import SettingsColorField from '../crud/SettingsColorField';
import { SettingsInlineForm } from '../crud/SettingsInlineForm';
import { useSettingsCan } from '../../context/settingsPermission';
import {
  useCreateLabel,
  useCreateLabelGroup,
  useDeleteLabel,
  useDeleteLabelGroup,
  useUpdateLabel,
  useUpdateLabelGroup,
} from '../../services/settings.service';
import { SettingsDraggableLabelRow } from './SettingsDraggableLabelRow';
import {
  SettingsLabelDeleteDialog,
  SettingsLabelGroupDeleteDialog,
} from './SettingsLabelDeleteDialogs';
import { SettingsLabelGroupSection } from './SettingsLabelGroupSection';
import { SettingsLabelsAddMenu } from './SettingsLabelsAddMenu';

// A tree of labels: each group is a collapsible node holding its labels, and
// ungrouped labels sit directly at the root alongside the groups. A group's header
// adds labels into that group; the "Add" action below the list adds a group or an
// ungrouped label. Labels drag between groups and the root.
export default function SettingsLabels({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // The open label add/edit form, and the open group add/edit form. At most one is
  // set at a time (opening either closes the other).
  const [labelForm, setLabelForm] = useState<
    { mode: 'add'; groupId: number | null } | { mode: 'edit'; id: number } | null
  >(null);
  const [lName, setLName] = useState('');
  const [lColor, setLColor] = useState(DEFAULT_COLOR);
  const [lGroupId, setLGroupId] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState<{ mode: 'add' } | { mode: 'edit'; id: number } | null>(
    null,
  );
  const [gName, setGName] = useState('');
  const [gColor, setGColor] = useState(DEFAULT_COLOR);
  const [deletingLabel, setDeletingLabel] = useState<LabelRow | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<LabelGroup | null>(null);

  const [activeId, setActiveId] = useState<number | null>(null);
  const can = useSettingsCan();
  const sensors = useDndSensors();

  const createLabel = useCreateLabel(projectKey);
  const updateLabel = useUpdateLabel(projectKey);
  const deleteLabel = useDeleteLabel(projectKey);
  const createLabelGroup = useCreateLabelGroup(projectKey);
  const updateLabelGroup = useUpdateLabelGroup(projectKey);
  const deleteLabelGroup = useDeleteLabelGroup(projectKey);

  const issueCount = (labelId: number) =>
    project.issues.filter((t) => t.labelIds.includes(labelId)).length;
  const labelCount = (groupId: number) =>
    project.labels.filter((l) => l.groupId === groupId).length;
  const hasGroups = project.labelGroups.length > 0;
  const activeLabel = activeId != null ? project.labels.find((l) => l.id === activeId) : null;
  const ungroupedLabels = project.labels.filter((l) => l.groupId == null);
  const addingUngrouped = labelForm?.mode === 'add' && labelForm.groupId === null;

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openLabelAdd(groupId: number | null, key: string) {
    setGroupForm(null);
    setLabelForm({ mode: 'add', groupId });
    setLName('');
    // Adding into a group defaults the label to the group's color.
    const groupColor =
      groupId != null ? project.labelGroups.find((g) => g.id === groupId)?.color : undefined;
    setLColor(groupColor ?? DEFAULT_COLOR);
    setLGroupId(groupId);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function openLabelEdit(l: LabelRow) {
    setGroupForm(null);
    setLabelForm({ mode: 'edit', id: l.id });
    setLName(l.name);
    setLColor(l.color);
    setLGroupId(l.groupId);
  }

  function openGroupAdd() {
    setLabelForm(null);
    setGroupForm({ mode: 'add' });
    setGName('');
    setGColor(DEFAULT_COLOR);
  }

  function openGroupEdit(g: LabelGroup) {
    setLabelForm(null);
    setGroupForm({ mode: 'edit', id: g.id });
    setGName(g.name);
    setGColor(g.color);
  }

  async function submitLabel() {
    if (!lName.trim() || !labelForm) return;
    if (labelForm.mode === 'add') {
      await createLabel.mutateAsync({ name: lName.trim(), color: lColor, groupId: lGroupId });
    } else {
      await updateLabel.mutateAsync({
        id: labelForm.id,
        patch: { name: lName.trim(), color: lColor, groupId: lGroupId },
      });
    }
    setLabelForm(null);
  }

  async function submitGroup() {
    if (!gName.trim() || !groupForm) return;
    if (groupForm.mode === 'add') {
      await createLabelGroup.mutateAsync({ name: gName.trim(), color: gColor });
    } else {
      await updateLabelGroup.mutateAsync({
        id: groupForm.id,
        patch: { name: gName.trim(), color: gColor },
      });
    }
    setGroupForm(null);
  }

  // Move the dragged label into the section it was dropped on (its group, or
  // ungrouped). No-op when dropped outside a section or on its current group.
  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const labelId = Number(e.active.id);
    const label = project.labels.find((l) => l.id === labelId);
    if (!label) return;
    const target = (e.over.data.current as { groupId: number | null } | undefined)?.groupId ?? null;
    if (target === label.groupId) return;
    await updateLabel.mutateAsync({ id: labelId, patch: { groupId: target } });
  }

  const labelFormEl = (
    <SettingsInlineForm
      name={lName}
      onNameChange={setLName}
      placeholder="Label name"
      submitLabel={labelForm?.mode === 'edit' ? 'Save' : 'Add'}
      onSubmit={() => void submitLabel()}
      onCancel={() => setLabelForm(null)}
      leading={<SettingsColorField value={lColor} onChange={setLColor} />}
    />
  );

  // A label as an editing form (when it is the one being edited) or a draggable row.
  function renderLabelRow(l: LabelRow) {
    if (labelForm?.mode === 'edit' && labelForm.id === l.id) {
      return (
        <div key={l.id} className="px-3 py-1">
          {labelFormEl}
        </div>
      );
    }
    const count = issueCount(l.id);
    return (
      <SettingsDraggableLabelRow
        key={l.id}
        label={l}
        draggable={hasGroups}
        meta={count === 0 ? undefined : `${count} ${count === 1 ? 'issue' : 'issues'}`}
        onEdit={() => openLabelEdit(l)}
        onDelete={() => setDeletingLabel(l)}
      />
    );
  }

  const groupFormEl = (
    <SettingsInlineForm
      name={gName}
      onNameChange={setGName}
      placeholder="Group name"
      submitLabel={groupForm?.mode === 'edit' ? 'Save' : 'Add'}
      onSubmit={() => void submitGroup()}
      onCancel={() => setGroupForm(null)}
      leading={<SettingsColorField value={gColor} onChange={setGColor} />}
    />
  );

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActiveId(Number(e.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="divide-y divide-border/50">
          {project.labelGroups.map((g) => {
            const key = `group:${g.id}`;
            const open = !collapsed.has(key);
            const labels = project.labels.filter((l) => l.groupId === g.id);
            const groupEditing = groupForm?.mode === 'edit' && groupForm.id === g.id;
            const addingHere = labelForm?.mode === 'add' && labelForm.groupId === g.id;
            return (
              <SettingsLabelGroupSection
                key={key}
                group={g}
                count={labels.length}
                empty={labels.length === 0 && !addingHere}
                dragging={activeId != null}
                open={open}
                editForm={groupEditing ? groupFormEl : undefined}
                onToggle={() => toggle(key)}
                onAddLabel={() => openLabelAdd(g.id, key)}
                onEditGroup={() => openGroupEdit(g)}
                onDeleteGroup={() => setDeletingGroup(g)}
              >
                {labels.map((l) => renderLabelRow(l))}
                {addingHere && <div className="px-3 py-1">{labelFormEl}</div>}
              </SettingsLabelGroupSection>
            );
          })}

          <SettingsLabelGroupSection
            group={null}
            headerless
            count={ungroupedLabels.length}
            empty={ungroupedLabels.length === 0 && !addingUngrouped}
            dragging={activeId != null}
            open
            onToggle={() => {}}
            onAddLabel={() => openLabelAdd(null, 'ungrouped')}
          >
            {ungroupedLabels.map((l) => renderLabelRow(l))}
            {addingUngrouped && <div className="px-3 py-1">{labelFormEl}</div>}
          </SettingsLabelGroupSection>
        </div>

        <DragOverlay>
          {activeLabel ? (
            <div className="flex items-center gap-1.5 rounded-md bg-popover px-2 py-1 text-sm shadow-lg">
              {colorDot(activeLabel.color)}
              {activeLabel.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {groupForm?.mode === 'add' && <div className="pt-1">{groupFormEl}</div>}

      {can('create') && (
        <SettingsLabelsAddMenu
          disabled={labelForm?.mode === 'add' || groupForm?.mode === 'add'}
          onAddLabel={() => openLabelAdd(null, 'ungrouped')}
          onAddGroup={openGroupAdd}
        />
      )}

      {deletingLabel && (
        <SettingsLabelDeleteDialog
          label={deletingLabel}
          issueCount={issueCount(deletingLabel.id)}
          onClose={() => setDeletingLabel(null)}
          onConfirm={async () => {
            await deleteLabel.mutateAsync(deletingLabel.id);
            setDeletingLabel(null);
          }}
        />
      )}

      {deletingGroup && (
        <SettingsLabelGroupDeleteDialog
          group={deletingGroup}
          labelCount={labelCount(deletingGroup.id)}
          onClose={() => setDeletingGroup(null)}
          onConfirm={async () => {
            await deleteLabelGroup.mutateAsync(deletingGroup.id);
            setDeletingGroup(null);
          }}
        />
      )}
    </div>
  );
}
