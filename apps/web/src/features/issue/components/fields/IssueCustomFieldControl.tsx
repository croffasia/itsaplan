import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { Assignee } from '@/lib/api/endpoints/projects';
import type { IssueFieldValueEntry, IssueFieldValueInput } from '@/lib/api/endpoints/issues';
import { formatDate, formatDateTimeRange } from '@/utils/dates';
import { Checkbox } from '@/components/ui/checkbox';
import DatePill from '@/components/common/fields/DatePill';
import DateTimePill from '@/components/common/fields/DateTimePill';
import Avatar from '@/components/common/Avatar';
import MemberSelect from './MemberSelect';
import InlineUrlField from './InlineUrlField';
import InlineTextField from './InlineTextField';
import IssueCustomFieldOptionsPick from './IssueCustomFieldOptionsPick';
import { useTranslations } from 'next-intl';

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
  defaultOpen,
}: {
  def: CustomField;
  current: IssueFieldValueEntry | undefined;
  assignees: Assignee[];
  saveKey: string;
  onChange: (value: IssueFieldValueInput) => void;
  readOnly?: boolean;
  // Opens the editor on mount, for a field the person has just added.
  defaultOpen?: boolean;
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
        defaultOpen={defaultOpen}
      />
    );
  }

  if (def.fieldType === 'url') {
    return (
      <InlineUrlField
        value={(current?.value as string | null) ?? null}
        saveKey={saveKey}
        onSave={(v) => onChange({ value: v })}
        defaultEditing={defaultOpen}
      />
    );
  }

  if (def.fieldType === 'date') {
    return (
      <DatePill
        value={(current?.value as string | null) ?? null}
        placeholder={tFields('empty')}
        onChange={(v) => onChange({ value: v })}
        defaultOpen={defaultOpen}
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
        defaultOpen={defaultOpen}
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
        defaultEditing={defaultOpen}
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

  // select / multi_select
  return (
    <IssueCustomFieldOptionsPick
      def={def}
      optionIds={current?.optionIds ?? []}
      onChange={(optionIds) => onChange({ optionIds })}
      defaultOpen={defaultOpen}
    />
  );
}
