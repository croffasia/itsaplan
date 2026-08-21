import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api';
import { SORT_FIELDS, type SortField, type WorkItemsView } from '@/utils/viewTypes';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

// Views that lay issues out as a list honor ordering; the date-laid-out
// Timeline and Calendar ignore it.
const ORDERING_VIEWS: WorkItemsView[] = ['kanban', 'table'];

// Grouping fields, in menu order, before the project's own member custom fields.
// Project always groups by something, so it drops 'none'.
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

// The grouping, sub-grouping, ordering, empty-group, links and subtasks rows.
// Which of them show depends on the layout: Timeline groups but does not order,
// Calendar does neither, and sub-grouping needs a primary group. Nested subtasks
// is a Display-properties chip on Project and Table; the Timeline has no chips, so
// it carries that toggle as a row here.
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
  const t = useTranslations('display.rows');
  const groupLabel = byKey(useTranslations('display.groupFields'));
  const sortLabel = byKey(useTranslations('display.sortFields'));

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

  const groupOptions = toOptions(
    view === 'kanban' || view === 'timeline' ? fields.filter((f) => f !== 'none') : fields,
  );
  // The sub-group never offers the field already used by the primary group.
  const subgroupOptions = toOptions(fields).filter((o) => o.value !== settings.group);
  const sortOptions = SORT_FIELDS.map((value) => ({ value, label: sortLabel(value) }));
  const showsGrouping = view === 'kanban' || view === 'table' || view === 'timeline';
  const showsSubgrouping = showsGrouping && settings.group !== 'none';

  return (
    <>
      {showsGrouping && (
        <DisplaySettingsRow label={view === 'kanban' ? t('columns') : t('grouping')}>
          <DisplaySettingsSelect
            value={settings.group}
            onChange={(v) => setGroup(v as GroupField)}
            options={groupOptions}
          />
        </DisplaySettingsRow>
      )}

      {showsSubgrouping && (
        <DisplaySettingsRow label={view === 'kanban' ? t('swimlanes') : t('subGrouping')}>
          <DisplaySettingsSelect
            value={settings.subgroup}
            onChange={(v) => onChange({ subgroup: v as GroupField })}
            options={subgroupOptions}
          />
        </DisplaySettingsRow>
      )}

      {ORDERING_VIEWS.includes(view) && (
        <DisplaySettingsRow label={t('ordering')}>
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            disabled={settings.sort.field === 'manual'}
            title={settings.sort.dir === 'asc' ? t('ascending') : t('descending')}
            onClick={() =>
              onChange({
                sort: { ...settings.sort, dir: settings.sort.dir === 'asc' ? 'desc' : 'asc' },
              })
            }
          >
            {settings.sort.dir === 'asc' ? <ArrowUpNarrowWide /> : <ArrowDownNarrowWide />}
          </Button>
          <DisplaySettingsSelect
            value={settings.sort.field}
            onChange={(v) => onChange({ sort: { ...settings.sort, field: v as SortField } })}
            options={sortOptions}
          />
        </DisplaySettingsRow>
      )}

      {showsGrouping && settings.group !== 'none' && (
        <DisplaySettingsRow
          label={view === 'kanban' ? t('showEmptyColumns') : t('showEmptyGroups')}
        >
          <Checkbox
            checked={settings.showEmptyGroups}
            onCheckedChange={(c) => onChange({ showEmptyGroups: c === true })}
          />
        </DisplaySettingsRow>
      )}

      {showsGrouping && (
        <>
          <DisplaySettingsRow label={t('showLinks')}>
            <Checkbox
              checked={settings.showLinks}
              onCheckedChange={(c) => onChange({ showLinks: c === true })}
            />
          </DisplaySettingsRow>

          {features.subtasks && (
            <>
              <DisplaySettingsRow
                label={view === 'kanban' ? t('separateSubtaskCards') : t('separateSubtaskRows')}
              >
                <Checkbox
                  checked={settings.separateSubtasks}
                  onCheckedChange={(c) => onChange({ separateSubtasks: c === true })}
                />
              </DisplaySettingsRow>

              {view === 'timeline' && (
                <DisplaySettingsRow label={t('showNestedSubtasks')}>
                  <Checkbox
                    checked={settings.showSubtasks}
                    onCheckedChange={(c) => onChange({ showSubtasks: c === true })}
                  />
                </DisplaySettingsRow>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
