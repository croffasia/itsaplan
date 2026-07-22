import { type CustomField, type IssueFieldValue, type IssueFieldValueInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import InlineUrlField from './InlineUrlField';
import InlineTextField from './InlineTextField';

// Radix Select forbids an empty-string item value, so "(none)" options use this
// sentinel and map back to '' / null on change.
const NONE = '__none__';

// The editor for one non-markdown custom field on a saved issue, picked by field
// type. Each change is persisted immediately through onChange. The parallel
// IssueCustomFieldPill collects the same values before an issue exists (new-issue
// modal); this one edits the live value.
export default function IssueCustomFieldControl({
  def,
  current,
  saveKey,
  onChange,
}: {
  def: CustomField;
  current: IssueFieldValue | undefined;
  saveKey: string;
  onChange: (value: IssueFieldValueInput) => void;
}) {
  if (def.fieldType === 'url') {
    return (
      <InlineUrlField
        value={(current?.value as string | null) ?? null}
        saveKey={saveKey}
        onSave={(v) => onChange({ value: v })}
      />
    );
  }

  if (def.fieldType === 'text' || def.fieldType === 'number' || def.fieldType === 'date') {
    return (
      <InlineTextField
        value={(current?.value as string | number | null) ?? null}
        fieldType={def.fieldType}
        saveKey={saveKey}
        onSave={(v) => onChange({ value: v })}
      />
    );
  }

  if (def.fieldType === 'boolean') {
    return (
      <Checkbox
        defaultChecked={Boolean(current?.value)}
        key={saveKey}
        onCheckedChange={(v) => onChange({ value: v === true })}
      />
    );
  }

  if (def.fieldType === 'select') {
    return (
      <Select
        value={current?.optionIds[0] != null ? String(current.optionIds[0]) : NONE}
        onValueChange={(v) => onChange({ optionIds: v === NONE ? [] : [Number(v)] })}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>(none)</SelectItem>
          {def.options.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // multi_select
  return (
    <div className="flex flex-wrap gap-1.5">
      {def.options.map((o) => {
        const selected = current?.optionIds.includes(o.id) ?? false;
        return (
          <Button
            key={o.id}
            type="button"
            variant={selected ? 'secondary' : 'outline'}
            size="sm"
            className="h-auto rounded-full px-2 py-0.5 text-xs"
            onClick={() => {
              const ids = current?.optionIds ?? [];
              onChange({ optionIds: selected ? ids.filter((x) => x !== o.id) : [...ids, o.id] });
            }}
          >
            {o.value}
          </Button>
        );
      })}
    </div>
  );
}
