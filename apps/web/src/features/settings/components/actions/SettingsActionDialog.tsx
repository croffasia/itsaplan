import { useState } from 'react';
import type { ActionEffect, ProjectDetail, CustomField } from '@/lib/api';
import { isActiveFilterSet, type FilterSet } from '@/utils/filters';
import { isEmptyEffect } from '@/utils/actions';
import Modal from '@/components/common/overlay/Modal';
import FilterBar from '@/components/layout/FilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsEffectEditor } from './SettingsEffectEditor';
import { SettingsActionIconPicker } from './SettingsActionIconPicker';

// The popup editor for one action (new or existing): an icon, a name, the
// availability condition (the shared FilterBar), and the effect. Edits are local
// until Save; the parent decides create vs update.
export function SettingsActionDialog({
  projectKey,
  project,
  customFields,
  mode,
  initialName,
  initialIcon,
  initialCondition,
  initialEffect,
  saving,
  onSave,
  onClose,
}: {
  projectKey: string;
  project: ProjectDetail;
  customFields: CustomField[];
  mode: 'new' | 'edit';
  initialName: string;
  initialIcon: string;
  initialCondition: FilterSet;
  initialEffect: ActionEffect;
  saving: boolean;
  onSave: (input: {
    name: string;
    icon: string;
    condition: FilterSet;
    effect: ActionEffect;
  }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [condition, setCondition] = useState<FilterSet>(initialCondition);
  const [effect, setEffect] = useState<ActionEffect>(initialEffect);

  const isValid = name.trim().length > 0 && !isEmptyEffect(effect);

  function submit() {
    if (!isValid) return;
    onSave({ name: name.trim(), icon, condition, effect });
  }

  const actionLabel = mode === 'edit' ? 'Save action' : 'Create action';
  const pendingLabel = mode === 'edit' ? 'Saving…' : 'Creating…';

  return (
    <Modal
      title={mode === 'edit' ? 'Edit action' : 'New action'}
      description="Pick an icon, name the action, and set which issues it applies to and what it changes."
      projectKey={projectKey}
      onClose={onClose}
      wide
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="action-name">Name</Label>
          <div className="flex gap-2">
            <SettingsActionIconPicker value={icon} onChange={setIcon} />
            <Input
              id="action-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Action name (e.g. Approve)"
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Available when</Label>
          <FilterBar
            filters={condition}
            onChange={setCondition}
            project={project}
            customFields={customFields}
          />
          {!isActiveFilterSet(condition) && (
            <p className="text-sm text-muted-foreground">No conditions. Always available.</p>
          )}
        </div>

        <div className="space-y-2.5">
          <Label>Then set</Label>
          <SettingsEffectEditor effect={effect} project={project} onChange={setEffect} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || saving}>
            {saving ? pendingLabel : actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
