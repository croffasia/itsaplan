import { useState } from 'react';
import type { ProjectDetail } from '@/lib/api';
import type { FilterCondition, FilterValue } from '@/utils/filters';
import { BOOLEAN_OPTIONS, valuesLabel, type FieldSpec } from '@/utils/filterFields';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import LabelPicker from '@/components/common/fields/LabelPicker';

// The value editor inside a condition pill, chosen by field kind. Presence
// operators (is_set/is_not_set) need no editor.
export default function FilterValueEditor({
  spec,
  cond,
  onChange,
  project,
}: {
  spec: FieldSpec;
  cond: FilterCondition;
  onChange: (values: FilterValue[]) => void;
  project: ProjectDetail;
}) {
  const [open, setOpen] = useState(false);

  if (cond.op === 'is_set' || cond.op === 'is_not_set') return null;

  // The labels field uses the shared grouped picker (submenus per label group),
  // toggling label ids in the condition's values.
  if (spec.field === 'labels') {
    const selected = cond.values.filter((v): v is number => typeof v === 'number');
    const toggleLabel = (id: number) =>
      onChange(selected.includes(id) ? cond.values.filter((v) => v !== id) : [...cond.values, id]);
    return (
      <LabelPicker
        labels={project.labels}
        groups={project.labelGroups}
        selected={selected}
        onToggle={toggleLabel}
        trigger={
          <button type="button" className="max-w-40 truncate rounded px-1 text-xs hover:bg-accent">
            {valuesLabel(spec, cond)}
          </button>
        }
      />
    );
  }

  if (spec.kind === 'date') {
    const current = typeof cond.values[0] === 'string' ? (cond.values[0] as string) : '';
    return (
      <Input
        type="date"
        value={current}
        onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        className="h-6 w-36 px-1.5 py-0 text-xs"
      />
    );
  }

  if (spec.kind === 'text') {
    const current = typeof cond.values[0] === 'string' ? (cond.values[0] as string) : '';
    return (
      <Input
        value={current}
        placeholder="value"
        onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        className="h-6 w-36 px-1.5 py-0 text-xs"
      />
    );
  }

  if (spec.kind === 'number') {
    const current = typeof cond.values[0] === 'number' ? String(cond.values[0]) : '';
    return (
      <Input
        type="number"
        value={current}
        placeholder="value"
        onChange={(e) => onChange(e.target.value === '' ? [] : [Number(e.target.value)])}
        className="h-6 w-24 px-1.5 py-0 text-xs"
      />
    );
  }

  // set / boolean — a popover with a checkbox list; multiple values OR together.
  const options = spec.kind === 'boolean' ? BOOLEAN_OPTIONS : (spec.options ?? []);
  const toggle = (value: FilterValue) => {
    const has = cond.values.some((v) => v === value);
    onChange(has ? cond.values.filter((v) => v !== value) : [...cond.values, value]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="max-w-40 truncate rounded px-1 text-xs hover:bg-accent">
          {valuesLabel(spec, cond)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-auto p-1">
        {options.map((o) => {
          const checked = cond.values.some((v) => v === o.value);
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => toggle(o.value)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent',
                checked && 'font-medium',
              )}
            >
              <span
                className={cn(
                  'size-3 rounded-full border',
                  checked ? 'border-primary bg-primary' : 'border-muted-foreground',
                )}
              />
              {o.color && (
                <span className="size-2.5 rounded-full" style={{ backgroundColor: o.color }} />
              )}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
        {options.length === 0 && (
          <p className="px-2 py-1 text-sm text-muted-foreground">No options</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
