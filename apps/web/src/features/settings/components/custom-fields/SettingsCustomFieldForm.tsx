import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { type CustomFieldType } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The field types offered when creating a field. Type is immutable after
// creation (the values are already stored), so the edit form shows it as text.
const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'markdown',
  'url',
  'number',
  'boolean',
  'date',
  'select',
  'multi_select',
];

// Display labels for the field types. The stored value stays the enum key; a few
// read as jargon when shown raw, so they map to plain words here.
export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'text',
  markdown: 'markdown',
  url: 'url',
  number: 'number',
  boolean: 'checkbox',
  date: 'date',
  select: 'select',
  multi_select: 'multi-select',
};

export interface FieldFormValues {
  name: string;
  fieldType: CustomFieldType;
  showInBody: boolean;
  options?: string[];
}

// A labelled boolean toggle with a short explanatory tooltip: the whole chip is
// the target, filled with the selected-chip color when on.
function Toggle({
  active,
  onClick,
  tooltip,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            active
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          <span
            className={cn(
              'flex size-3.5 items-center justify-center rounded-[4px] transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'border border-input',
            )}
          >
            {active && <Check className="size-2.5" />}
          </span>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// The add/edit form for one custom field, on a subtly raised surface (a
// background shift, not a border). Name and type sit on the first row; the
// placement toggle and the actions on the second, so nothing crowds. In edit
// mode the type is fixed; options are only set at creation.
export function SettingsCustomFieldForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: 'add' | 'edit';
  initial?: {
    name?: string;
    fieldType?: CustomFieldType;
    showInBody?: boolean;
  };
  onSubmit: (values: FieldFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [fieldType, setFieldType] = useState<CustomFieldType>(initial?.fieldType ?? 'text');
  const [showInBody, setShowInBody] = useState(initial?.showInBody ?? false);
  const [options, setOptions] = useState('');
  const needsOptions = mode === 'add' && (fieldType === 'select' || fieldType === 'multi_select');

  // Picking a type presets the placement to its default (body for markdown,
  // properties otherwise); the user can still flip it before saving.
  function changeType(v: CustomFieldType) {
    setFieldType(v);
    setShowInBody(v === 'markdown');
  }

  function submit() {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      fieldType,
      showInBody,
      options: needsOptions
        ? options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined,
    });
  }

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Field name"
          className="h-8 flex-1 bg-background"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !needsOptions) submit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <Button size="sm" className="h-8" disabled={!name.trim()} onClick={submit}>
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {needsOptions && (
        <Input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder="Options: Low, Medium, High"
          className="h-8 bg-background"
        />
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Type</span>
          {mode === 'add' ? (
            <Select value={fieldType} onValueChange={(v) => changeType(v as CustomFieldType)}>
              <SelectTrigger className="h-7 w-32 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-foreground">{FIELD_TYPE_LABELS[fieldType]}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Toggle
            active={showInBody}
            onClick={() => setShowInBody((v) => !v)}
            tooltip="Shows in the issue body, not Properties"
          >
            Main info
          </Toggle>
        </div>
      </div>
    </div>
  );
}
