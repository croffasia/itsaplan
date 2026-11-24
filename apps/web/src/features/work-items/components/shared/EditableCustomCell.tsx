import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { Issue, IssueFieldValueInput } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { type Maps } from '@/utils/project';
import { Checkbox } from '@/components/ui/checkbox';
import { colorDot } from '@/components/common/fields/colorDot';
import DatePill from '@/components/common/fields/DatePill';
import DateTimePill from '@/components/common/fields/DateTimePill';
import PopoverPick from '@/components/common/fields/PopoverPick';
import MemberSelect from '@/features/issue/components/fields/MemberSelect';
import { TableCustomCell } from '../table/TableCustomCell';
import { CellButton } from './CellButton';
import { CellEditor } from './CellEditor';
import { CustomFieldPopover } from './CustomFieldPopover';

// One custom field cell. It reads like a Table cell; when the issue can be edited
// and its type holds the field, a click opens the field's editor: the issue
// panel's own, or for a select the picker the other fields use. A markdown field
// is shown only.
export function EditableCustomCell({
  field,
  issue,
  project,
  maps,
  readOnly,
  onChange,
}: {
  field: CustomField;
  issue: Issue;
  project: ProjectDetail;
  maps: Maps;
  readOnly: boolean;
  onChange: (value: IssueFieldValueInput) => void;
}) {
  const value = <TableCustomCell field={field} issue={issue} maps={maps} />;
  if (
    readOnly ||
    field.fieldType === 'markdown' ||
    (field.issueTypeId != null && field.issueTypeId !== issue.typeId)
  ) {
    return value;
  }
  return (
    <CellEditor>
      <CustomFieldEditor
        field={field}
        issue={issue}
        project={project}
        trigger={<CellButton>{value}</CellButton>}
        onChange={onChange}
      />
    </CellEditor>
  );
}

function CustomFieldEditor({
  field,
  issue,
  project,
  trigger,
  onChange,
}: {
  field: CustomField;
  issue: Issue;
  project: ProjectDetail;
  trigger: ReactNode;
  onChange: (value: IssueFieldValueInput) => void;
}) {
  const t = useTranslations('issue.customFields');
  const entry = issue.fieldValues.find((v) => v.fieldId === field.id);
  const raw = entry?.value ?? null;

  switch (field.fieldType) {
    case 'boolean':
      return (
        <Checkbox
          checked={raw === true}
          onCheckedChange={(checked) => onChange({ value: checked === true })}
        />
      );
    case 'member':
      return (
        <MemberSelect
          assignees={project.assignees}
          scope={field.memberScope ?? 'all'}
          value={typeof raw === 'string' ? raw : null}
          onChange={(userId) => onChange({ value: userId })}
          trigger={trigger}
        />
      );
    case 'date':
      return (
        <DatePill
          value={typeof raw === 'string' ? raw : null}
          onChange={(v) => onChange({ value: v })}
          trigger={trigger}
        />
      );
    case 'datetime':
    case 'datetime_range':
      return (
        <DateTimePill
          value={typeof raw === 'string' ? raw : null}
          valueEnd={entry?.valueEnd ?? null}
          range={field.fieldType === 'datetime_range'}
          onChange={(v, valueEnd) => onChange({ value: v, valueEnd })}
          trigger={trigger}
        />
      );
    case 'select':
    case 'multi_select': {
      const single = field.fieldType === 'select';
      const selected = entry?.optionIds ?? [];
      return (
        <PopoverPick
          trigger={trigger}
          inputPlaceholder={t('pickOption')}
          emptyText={t('noOptions')}
          closeOnSelect={single}
          items={[
            ...(single
              ? [
                  {
                    key: 'none',
                    search: t('noOption'),
                    icon: <CircleDashed />,
                    label: t('noOption'),
                    selected: selected.length === 0,
                    onSelect: () => onChange({ optionIds: [] }),
                  },
                ]
              : []),
            ...field.options.map((o) => ({
              key: String(o.id),
              search: o.value,
              icon: colorDot(o.color),
              label: o.value,
              selected: selected.includes(o.id),
              onSelect: () =>
                onChange({
                  optionIds: single
                    ? [o.id]
                    : selected.includes(o.id)
                      ? selected.filter((id) => id !== o.id)
                      : [...selected, o.id],
                }),
            })),
          ]}
        />
      );
    }
    default:
      // A url cell shows its address as text: the link to open it is in the
      // editor, since a link cannot sit inside the button.
      return (
        <CustomFieldPopover
          trigger={
            field.fieldType === 'url' && typeof raw === 'string' && raw !== '' ? (
              <CellButton>
                <span className="truncate text-xs text-muted-foreground">{raw}</span>
              </CellButton>
            ) : (
              trigger
            )
          }
          field={field}
          entry={entry}
          assignees={project.assignees}
          saveKey={`${field.id}-${issue.updatedAt}`}
          onChange={onChange}
        />
      );
  }
}
