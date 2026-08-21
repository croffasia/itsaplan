import {
  type Assignee,
  type CustomField,
  type IssueFieldValue,
  type IssueFieldValueInput,
} from '@/lib/api';
import { formatDate, formatDateTimeRange } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import DatePill from '@/components/common/fields/DatePill';
import DateTimePill from '@/components/common/fields/DateTimePill';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Avatar from '@/components/common/Avatar';
import MemberSelect from './MemberSelect';
import InlineUrlField from './InlineUrlField';
import InlineTextField from './InlineTextField';
import { useTranslations } from 'next-intl';

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
  assignees,
  saveKey,
  onChange,
  readOnly,
}: {
  def: CustomField;
  current: IssueFieldValue | undefined;
  assignees: Assignee[];
  saveKey: string;
  onChange: (value: IssueFieldValueInput) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.customFields');
  const tFields = useTranslations('issue.fields');
  // Read-only: show the current value statically, no editor.
  if (readOnly) {
    if (def.fieldType === 'select' || def.fieldType === 'multi_select') {
      const opts = (current?.optionIds ?? [])
        .map((id) => def.options.find((o) => o.id === id))
        .filter((o): o is NonNullable<typeof o> => o != null);
      if (opts.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {opts.map((o) => (
            <span
              key={o.id}
              className="rounded px-1.5 py-0.5 text-xs text-white"
              style={{ backgroundColor: o.color }}
            >
              {o.value}
            </span>
          ))}
        </span>
      );
    }
    if (def.fieldType === 'member') {
      const member = assignees.find((a) => a.userId === current?.value);
      if (!member) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <span className="flex items-center gap-1.5 text-sm">
          <Avatar name={member.name} image={member.image} className="size-4 text-[8px]" />
          {member.name}
        </span>
      );
    }
    if (def.fieldType === 'boolean') {
      return <span className="text-sm">{current?.value ? t('yes') : t('no')}</span>;
    }
    const v = current?.value;
    if (v == null || v === '') return <span className="text-sm text-muted-foreground">—</span>;
    if (def.fieldType === 'date') return <span className="text-sm">{formatDate(String(v))}</span>;
    if (def.fieldType === 'datetime' || def.fieldType === 'datetime_range') {
      return (
        <span className="text-sm">{formatDateTimeRange(String(v), current?.valueEnd ?? null)}</span>
      );
    }
    return <span className="text-sm">{String(v)}</span>;
  }

  if (def.fieldType === 'member') {
    return (
      <MemberSelect
        assignees={assignees}
        scope={def.memberScope ?? 'all'}
        value={(current?.value as string | null) ?? null}
        placeholder={def.name}
        onChange={(userId) => onChange({ value: userId })}
      />
    );
  }

  if (def.fieldType === 'url') {
    return (
      <InlineUrlField
        value={(current?.value as string | null) ?? null}
        saveKey={saveKey}
        onSave={(v) => onChange({ value: v })}
      />
    );
  }

  if (def.fieldType === 'date') {
    return (
      <DatePill
        value={(current?.value as string | null) ?? null}
        placeholder={tFields('empty')}
        onChange={(v) => onChange({ value: v })}
      />
    );
  }

  if (def.fieldType === 'datetime' || def.fieldType === 'datetime_range') {
    return (
      <DateTimePill
        value={(current?.value as string | null) ?? null}
        valueEnd={current?.valueEnd ?? null}
        range={def.fieldType === 'datetime_range'}
        placeholder={tFields('empty')}
        onChange={(value, valueEnd) => onChange({ value, valueEnd })}
      />
    );
  }

  if (def.fieldType === 'text' || def.fieldType === 'number') {
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
