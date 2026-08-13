import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api';
import {
  customFieldKey,
  type BuiltinDateField,
  type DateField,
  type ViewSettings,
  type WeekStart,
} from '@/utils/viewSettings';
import { isCalendarField } from '@/utils/calendarFields';
import { byKey } from '@/utils/messageKey';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

const DATE_FIELDS: BuiltinDateField[] = ['dueDate', 'startDate'];
const WEEK_STARTS = ['0', '1'] as const;

// The Display settings rows that only apply to the Calendar layout.
export default function DisplayCalendarRows({
  settings,
  customFields,
  onChange,
}: {
  settings: ViewSettings;
  customFields: CustomField[];
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const t = useTranslations('display.rows');
  const dateField = byKey(useTranslations('display.dateFields'));
  const weekStart = byKey(useTranslations('display.weekStart'));
  const options = [
    ...DATE_FIELDS.map((value) => ({ value, label: dateField(value) })),
    ...customFields
      .filter(isCalendarField)
      .map((f) => ({ value: customFieldKey(f.id), label: f.name })),
  ];
  return (
    <>
      <DisplaySettingsRow label={t('placeBy')}>
        <DisplaySettingsSelect
          value={settings.calendarDateField}
          onChange={(v) => onChange({ calendarDateField: v as DateField })}
          options={options}
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
