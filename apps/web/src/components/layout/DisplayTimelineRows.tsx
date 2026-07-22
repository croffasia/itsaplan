import type { TimelineScale, ViewSettings } from '@/utils/viewSettings';
import { Checkbox } from '@/components/ui/checkbox';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

const SCALE_OPTIONS: { value: TimelineScale; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
];

// The Display settings rows that only apply to the Timeline layout.
export default function DisplayTimelineRows({
  settings,
  onChange,
}: {
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  return (
    <>
      <DisplaySettingsRow label="Start with groups collapsed">
        <Checkbox
          checked={settings.timelineCollapseAll}
          onCheckedChange={(checked) => onChange({ timelineCollapseAll: checked === true })}
        />
      </DisplaySettingsRow>
      <DisplaySettingsRow label="Scale">
        <DisplaySettingsSelect
          value={settings.timelineScale}
          onChange={(v) => onChange({ timelineScale: v as TimelineScale })}
          options={SCALE_OPTIONS}
        />
      </DisplaySettingsRow>
    </>
  );
}
