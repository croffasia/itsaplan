import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { WorkItemsView } from '@/utils/viewTypes';
import {
  customFieldKey,
  isFieldEnabled,
  type BuiltinGroupField,
  type GroupField,
  type ViewSettings,
} from '@/utils/viewSettings';
import { isMemberField } from '@/utils/memberFields';
import { byKey } from '@/utils/messageKey';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import DisplayOrderingRow from '@/components/layout/DisplayOrderingRow';
import DisplaySection from '@/components/layout/DisplaySection';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';
import DisplayToggleRow from '@/components/layout/DisplayToggleRow';

// Grouping fields, in menu order, before the project's own member custom fields.
// Kanban and Timeline always group by something, so they drop 'none'.
const GROUP_FIELDS: BuiltinGroupField[] = [
  'none',
  'status',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle',
];

// The Timeline lays its issues out by date, so instead of an ordering it offers the
// initial state of its groups.
export default function DisplayGroupingRows({
  view,
  settings,
  customFields,
  onChange,
}: {
  view: WorkItemsView;
  settings: ViewSettings;
  customFields: CustomField[];
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const t = useTranslations('display');
  const groupLabel = byKey(useTranslations('display.groupFields'));

  // Changing the primary group clears a sub-group that would now duplicate it.
  const setGroup = (group: GroupField) =>
    onChange(group === settings.subgroup ? { group, subgroup: 'none' } : { group });

  // Initiative and Cycle are only offered while the project shows their section. A
  // member custom field groups by whoever it holds, and is named by itself.
  const features = useProjectFeatures();
  const fields = GROUP_FIELDS.filter((f) => isFieldEnabled(f, features));
  const memberOptions = customFields
    .filter(isMemberField)
    .map((f) => ({ value: customFieldKey(f.id), label: f.name }));
  const toOptions = (values: BuiltinGroupField[]): { value: GroupField; label: string }[] => [
    ...values.map((value) => ({ value, label: groupLabel(value) })),
    ...memberOptions,
  ];

  const kanban = view === 'kanban';
  const groupOptions = toOptions(view === 'table' ? fields : fields.filter((f) => f !== 'none'));
  // The sub-group never offers the field already used by the primary group.
  const subgroupOptions = toOptions(fields).filter((o) => o.value !== settings.group);

  return (
    <DisplaySection title={kanban ? t('sections.board') : t('sections.rows')}>
      <DisplaySettingsRow label={kanban ? t('rows.columns') : t('rows.grouping')}>
        <DisplaySettingsSelect
          value={settings.group}
          onChange={(v) => setGroup(v as GroupField)}
          options={groupOptions}
        />
      </DisplaySettingsRow>

      {settings.group !== 'none' && (
        <DisplaySettingsRow label={kanban ? t('rows.swimlanes') : t('rows.subGrouping')}>
          <DisplaySettingsSelect
            value={settings.subgroup}
            onChange={(v) => onChange({ subgroup: v as GroupField })}
            options={subgroupOptions}
          />
        </DisplaySettingsRow>
      )}

      {view === 'timeline' ? (
        <DisplayToggleRow
          label={t('rows.groupsCollapsed')}
          checked={settings.timelineCollapseAll}
          onCheckedChange={(timelineCollapseAll) => onChange({ timelineCollapseAll })}
        />
      ) : (
        <DisplayOrderingRow sort={settings.sort} onChange={(sort) => onChange({ sort })} />
      )}
    </DisplaySection>
  );
}
