import { useFormatter, useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import {
  CALENDAR_MAX_DAYS,
  CALENDAR_MAX_WEEKS,
  CALENDAR_MODES,
  customFieldKey,
  type BuiltinDateField,
  type DateField,
  type ViewSettings,
  type WeekStart,
} from '@/utils/viewSettings';
import { isCalendarField } from '@/utils/calendarFields';
import { byKey } from '@/utils/messageKey';
import DisplaySection from '@/components/layout/DisplaySection';
import DisplaySegmented from '@/components/layout/DisplaySegmented';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';
import DisplayToggleRow from '@/components/layout/DisplayToggleRow';

const DATE_FIELDS: BuiltinDateField[] = ['dueDate', 'startDate'];
const WEEK_STARTS = ['0', '1'] as const;

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
  const section = useTranslations('display.sections');
  const dateField = byKey(useTranslations('display.dateFields'));
  const weekStart = byKey(useTranslations('display.weekStart'));
  const mode = byKey(useTranslations('display.calendarModes'));
  const format = useFormatter();
  const counts = (max: number) =>
    Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: format.number(i + 1) }));
  const options = [
    ...DATE_FIELDS.map((value) => ({ value, label: dateField(value) })),
    ...customFields
      .filter(isCalendarField)
      .map((f) => ({ value: customFieldKey(f.id), label: f.name })),
  ];
  return (
    <>
      <DisplaySection>
        <DisplaySettingsRow label={t('mode')}>
          <DisplaySegmented
            value={settings.calendarMode}
            onChange={(calendarMode) => onChange({ calendarMode })}
            options={CALENDAR_MODES.map((value) => ({ value, label: mode(value) }))}
          />
        </DisplaySettingsRow>
      </DisplaySection>

      {settings.calendarMode === 'byDay' && (
        <DisplaySection title={section('columns')}>
          <DisplaySettingsRow label={t('daysShown')}>
            <DisplaySettingsSelect
              value={String(settings.calendarDays)}
              onChange={(v) => onChange({ calendarDays: Number(v) })}
              options={counts(CALENDAR_MAX_DAYS)}
            />
          </DisplaySettingsRow>
        </DisplaySection>
      )}
      {settings.calendarMode === 'byWeek' && (
        <DisplaySection title={section('columns')}>
          <DisplaySettingsRow label={t('weeksShown')}>
            <DisplaySettingsSelect
              value={String(settings.calendarWeeks)}
              onChange={(v) => onChange({ calendarWeeks: Number(v) })}
              options={counts(CALENDAR_MAX_WEEKS)}
            />
          </DisplaySettingsRow>
          <DisplayToggleRow
            label={t('splitByDay')}
            checked={settings.calendarSplitByDay}
            onCheckedChange={(calendarSplitByDay) => onChange({ calendarSplitByDay })}
          />
        </DisplaySection>
      )}

      <DisplaySection title={section('dates')}>
        <DisplaySettingsRow label={t('placeBy')}>
          <DisplaySettingsSelect
            value={settings.calendarDateField}
            onChange={(v) => onChange({ calendarDateField: v as DateField })}
            options={options}
          />
        </DisplaySettingsRow>
        <DisplaySettingsRow label={t('weekStartsOn')}>
          <DisplaySegmented
            value={String(settings.weekStart)}
            onChange={(v) => onChange({ weekStart: Number(v) as WeekStart })}
            options={WEEK_STARTS.map((value) => ({ value, label: weekStart(value) }))}
          />
        </DisplaySettingsRow>
      </DisplaySection>
    </>
  );
}
