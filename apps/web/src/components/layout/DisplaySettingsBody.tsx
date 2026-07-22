import type { CustomField, IssueType } from '@/lib/api';
import type { WorkItemsView } from '@/utils/viewTypes';
import type { ViewSettings } from '@/utils/viewSettings';
import DisplayCalendarRows from '@/components/layout/DisplayCalendarRows';
import DisplayGroupingRows from '@/components/layout/DisplayGroupingRows';
import DisplayLayoutTabs from '@/components/layout/DisplayLayoutTabs';
import DisplayPropertiesSection from '@/components/layout/DisplayPropertiesSection';
import DisplayTimelineRows from '@/components/layout/DisplayTimelineRows';

// The body of the Display settings: a tabbed layout switcher (Project/Table/
// Timeline/Calendar) and the settings for the selected layout. Rendered inside
// the DisplayPopover. Settings belong to the active project+view or saved view
// (see the view editor and lib/viewSettings).
export default function DisplaySettingsBody({
  view,
  onViewChange,
  settings,
  onSettingsChange,
  customFields,
  issueTypes,
}: {
  view: WorkItemsView;
  onViewChange: (view: WorkItemsView) => void;
  settings: ViewSettings;
  onSettingsChange: (settings: ViewSettings) => void;
  customFields: CustomField[];
  issueTypes: IssueType[];
}) {
  const set = (patch: Partial<ViewSettings>) => onSettingsChange({ ...settings, ...patch });

  return (
    <div className="space-y-2">
      <DisplayLayoutTabs view={view} onViewChange={onViewChange} />

      <DisplayGroupingRows view={view} settings={settings} onChange={set} />

      {view === 'timeline' && <DisplayTimelineRows settings={settings} onChange={set} />}

      {view === 'calendar' && <DisplayCalendarRows settings={settings} onChange={set} />}

      {(view === 'kanban' || view === 'table') && (
        <DisplayPropertiesSection
          view={view}
          settings={settings}
          onChange={set}
          customFields={customFields}
          issueTypes={issueTypes}
        />
      )}
    </div>
  );
}
