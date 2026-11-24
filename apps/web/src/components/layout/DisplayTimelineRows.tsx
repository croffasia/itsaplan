import { useTranslations } from 'next-intl';
import type { TimelineScale, ViewSettings } from '@/utils/viewSettings';
import { byKey } from '@/utils/messageKey';
import DisplaySection from '@/components/layout/DisplaySection';
import DisplaySegmented from '@/components/layout/DisplaySegmented';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';

const SCALES: TimelineScale[] = ['week', 'month', 'quarter'];

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
    <DisplaySection>
      <DisplaySettingsRow label={t('scale')}>
        <DisplaySegmented
          value={settings.timelineScale}
          onChange={(timelineScale) => onChange({ timelineScale })}
          options={SCALES.map((value) => ({ value, label: scale(value) }))}
        />
      </DisplaySettingsRow>
    </DisplaySection>
  );
}
