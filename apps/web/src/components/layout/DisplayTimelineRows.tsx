import { useTranslations } from 'next-intl';
import type { TimelineScale, ViewSettings } from '@/utils/viewSettings';
import { byKey } from '@/utils/messageKey';
import { Checkbox } from '@/components/ui/checkbox';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

const SCALES: TimelineScale[] = ['week', 'month', 'quarter'];

// The Display settings rows that only apply to the Timeline layout.
export default function DisplayTimelineRows({
  settings,
  onChange,
}: {
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const t = useTranslations('display.rows');
  const scale = byKey(useTranslations('display.timelineScales'));
  return (
    <>
      <DisplaySettingsRow label={t('startCollapsed')}>
        <Checkbox
          checked={settings.timelineCollapseAll}
          onCheckedChange={(checked) => onChange({ timelineCollapseAll: checked === true })}
        />
      </DisplaySettingsRow>
      <DisplaySettingsRow label={t('scale')}>
        <DisplaySettingsSelect
          value={settings.timelineScale}
          onChange={(v) => onChange({ timelineScale: v as TimelineScale })}
          options={SCALES.map((value) => ({ value, label: scale(value) }))}
        />
      </DisplaySettingsRow>
    </>
  );
}
