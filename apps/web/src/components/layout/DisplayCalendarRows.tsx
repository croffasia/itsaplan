import { useTranslations } from 'next-intl';
import type { DateField, ViewSettings, WeekStart } from '@/utils/viewSettings';
import { byKey } from '@/utils/messageKey';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

const DATE_FIELDS: DateField[] = ['dueDate', 'startDate'];
const WEEK_STARTS = ['0', '1'] as const;

// The Display settings rows that only apply to the Calendar layout.
export default function DisplayCalendarRows({
  settings,
  onChange,
}: {
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const t = useTranslations('display.rows');
  const dateField = byKey(useTranslations('display.dateFields'));
  const weekStart = byKey(useTranslations('display.weekStart'));
  return (
    <>
      <DisplaySettingsRow label={t('placeBy')}>
        <DisplaySettingsSelect
          value={settings.calendarDateField}
          onChange={(v) => onChange({ calendarDateField: v as DateField })}
          options={DATE_FIELDS.map((value) => ({ value, label: dateField(value) }))}
        />
      </DisplaySettingsRow>
      <DisplaySettingsRow label={t('startWeekOn')}>
        <DisplaySettingsSelect
          value={String(settings.weekStart)}
          onChange={(v) => onChange({ weekStart: Number(v) as WeekStart })}
          options={WEEK_STARTS.map((value) => ({ value, label: weekStart(value) }))}
        />
      </DisplaySettingsRow>
    </>
  );
}
