import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';
import { SORT_FIELDS, type SortField, type WorkItemsView } from '@/utils/viewTypes';
import type { GroupField, ViewSettings } from '@/utils/viewSettings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

// Views that lay issues out as a list honor ordering; the date-laid-out
// Timeline and Calendar ignore it.
const ORDERING_VIEWS: WorkItemsView[] = ['kanban', 'table'];

// Grouping options. Project always groups by something, so it drops 'none'.
const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'State' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'delegate', label: 'Delegate' },
  { value: 'priority', label: 'Priority' },
  { value: 'type', label: 'Type' },
  { value: 'initiative', label: 'Initiative' },
];

// The grouping, sub-grouping, ordering and empty-group rows. Which of them show
// depends on the layout: Timeline groups but does not order, Calendar does
// neither, and sub-grouping needs a primary group.
export default function DisplayGroupingRows({
  view,
  settings,
  onChange,
}: {
  view: WorkItemsView;
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  // Changing the primary group clears a sub-group that would now duplicate it.
  const setGroup = (group: GroupField) =>
    onChange(group === settings.subgroup ? { group, subgroup: 'none' } : { group });

  const groupOptions =
    view === 'kanban' || view === 'timeline'
      ? GROUP_OPTIONS.filter((o) => o.value !== 'none')
      : GROUP_OPTIONS;
  // The sub-group never offers the field already used by the primary group.
  const subgroupOptions = GROUP_OPTIONS.filter((o) => o.value !== settings.group);
  const showsGrouping = view === 'kanban' || view === 'table' || view === 'timeline';
  const showsSubgrouping = (view === 'kanban' || view === 'table') && settings.group !== 'none';

  return (
    <>
      {showsGrouping && (
        <DisplaySettingsRow label={view === 'kanban' ? 'Columns' : 'Grouping'}>
          <DisplaySettingsSelect
            value={settings.group}
            onChange={(v) => setGroup(v as GroupField)}
            options={groupOptions}
          />
        </DisplaySettingsRow>
      )}

      {showsSubgrouping && (
        <DisplaySettingsRow label={view === 'kanban' ? 'Swimlanes' : 'Sub-grouping'}>
          <DisplaySettingsSelect
            value={settings.subgroup}
            onChange={(v) => onChange({ subgroup: v as GroupField })}
            options={subgroupOptions}
          />
        </DisplaySettingsRow>
      )}

      {ORDERING_VIEWS.includes(view) && (
        <DisplaySettingsRow label="Ordering">
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            disabled={settings.sort.field === 'manual'}
            title={settings.sort.dir === 'asc' ? 'Ascending' : 'Descending'}
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
            options={SORT_FIELDS}
          />
        </DisplaySettingsRow>
      )}

      {showsGrouping && settings.group !== 'none' && (
        <DisplaySettingsRow label={view === 'kanban' ? 'Show empty columns' : 'Show empty groups'}>
          <Checkbox
            checked={settings.showEmptyGroups}
            onCheckedChange={(c) => onChange({ showEmptyGroups: c === true })}
          />
        </DisplaySettingsRow>
      )}
    </>
  );
}
