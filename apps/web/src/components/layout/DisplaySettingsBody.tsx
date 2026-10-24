import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { WorkItemsView } from '@/utils/viewTypes';
import type { ViewSettings } from '@/utils/viewSettings';
import DisplayCalendarRows from '@/components/layout/DisplayCalendarRows';
import DisplayGroupingRows from '@/components/layout/DisplayGroupingRows';
import DisplayLayoutTabs from '@/components/layout/DisplayLayoutTabs';
import DisplayPropertiesSection from '@/components/layout/DisplayPropertiesSection';
import DisplayShowRows from '@/components/layout/DisplayShowRows';
import DisplaySubtaskRows from '@/components/layout/DisplaySubtaskRows';
import DisplayTimelineRows from '@/components/layout/DisplayTimelineRows';

// Settings belong to the active project+view or saved view (see the view editor and
// utils/viewSettings).
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
    <>
      <DisplayLayoutTabs view={view} onViewChange={onViewChange} />

      <div>
        {view === 'calendar' ? (
          <DisplayCalendarRows settings={settings} customFields={customFields} onChange={set} />
        ) : (
          <>
            {view === 'timeline' && <DisplayTimelineRows settings={settings} onChange={set} />}
            <DisplayGroupingRows
              view={view}
              settings={settings}
              customFields={customFields}
              onChange={set}
            />
            <DisplayShowRows view={view} settings={settings} onChange={set} />
            <DisplaySubtaskRows view={view} settings={settings} onChange={set} />
            <DisplayPropertiesSection
              view={view}
              settings={settings}
              onChange={set}
              customFields={customFields}
              issueTypes={issueTypes}
            />
          </>
        )}
      </div>
    </>
  );
}
