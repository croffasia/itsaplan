import { Fragment, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ActionEffect, ProjectDetail } from '@/lib/api';
import {
  EFFECT_FIELD_KEYS,
  EFFECT_FIELD_LABELS,
  effectFieldKeys,
  type EffectFieldKey,
} from '@/utils/actions';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import StatusSelect from '@/components/common/fields/StatusSelect';
import TypeSelect from '@/components/common/fields/TypeSelect';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The default value used when a field is first added to an effect. null on a
// nullable field means "clear it" on apply; the user then picks a real value.
function defaultEffectValue(
  key: EffectFieldKey,
  project: ProjectDetail,
): ActionEffect[EffectFieldKey] {
  switch (key) {
    case 'columnId':
      return project.columns[0]?.id ?? 0;
    case 'labelIds':
      return [];
    default:
      return null;
  }
}

// The value control for one set effect field, reusing the issue field selectors
// so the effect is edited exactly like the issue property it sets.
function EffectValue({
  effect,
  fieldKey,
  project,
  onChange,
}: {
  effect: ActionEffect;
  fieldKey: EffectFieldKey;
  project: ProjectDetail;
  onChange: (v: ActionEffect[EffectFieldKey]) => void;
}) {
  switch (fieldKey) {
    case 'columnId':
      return (
        <StatusSelect
          columns={project.columns}
          value={effect.columnId ?? project.columns[0]?.id ?? 0}
          onChange={onChange}
        />
      );
    case 'assigneeUserId':
      return (
        <AssigneeSelect
          assignees={project.assignees}
          value={effect.assigneeUserId ?? null}
          onChange={onChange}
        />
      );
    case 'priority':
      return <PrioritySelect value={effect.priority ?? ''} onChange={(v) => onChange(v || null)} />;
    case 'typeId':
      return (
        <TypeSelect
          issueTypes={project.issueTypes}
          value={effect.typeId ?? null}
          onChange={onChange}
        />
      );
    case 'startDate':
      return (
        <DatePill value={effect.startDate ?? null} placeholder="Set date" onChange={onChange} />
      );
    case 'dueDate':
      return <DatePill value={effect.dueDate ?? null} placeholder="Set date" onChange={onChange} />;
    case 'labelIds': {
      const ids = effect.labelIds ?? [];
      const toggle = (id: number) =>
        onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
      return (
        <LabelsSelect
          labels={project.labels}
          groups={project.labelGroups}
          value={ids}
          onToggle={toggle}
        />
      );
    }
  }
}

export function SettingsEffectEditor({
  effect,
  project,
  onChange,
}: {
  effect: ActionEffect;
  project: ProjectDetail;
  onChange: (e: ActionEffect) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const setKeys = effectFieldKeys(effect);
  const available = EFFECT_FIELD_KEYS.filter((k) => !(k in effect));

  const setValue = (key: EffectFieldKey, value: ActionEffect[EffectFieldKey]) =>
    onChange({ ...effect, [key]: value });
  const removeKey = (key: EffectFieldKey) => {
    const next = { ...effect };
    delete next[key];
    onChange(next);
  };
  const addKey = (key: EffectFieldKey) => {
    onChange({ ...effect, [key]: defaultEffectValue(key, project) });
    setAddOpen(false);
  };

  return (
    <div>
      {setKeys.length > 0 && (
        <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5">
          {setKeys.map((key) => (
            <Fragment key={key}>
              <div className="text-sm text-muted-foreground">{EFFECT_FIELD_LABELS[key]}</div>
              <div className="flex items-center gap-1.5">
                <EffectValue
                  effect={effect}
                  fieldKey={key}
                  project={project}
                  onChange={(v) => setValue(key, v)}
                />
                <button
                  type="button"
                  onClick={() => removeKey(key)}
                  title="Remove field"
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </Fragment>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground ${setKeys.length > 0 ? 'mt-2' : ''}`}
            >
              <Plus className="size-4" />
              Add field
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1">
            {available.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => addKey(key)}
                className="w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {EFFECT_FIELD_LABELS[key]}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
