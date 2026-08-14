import { useId } from 'react';
import { SettingsSuggestionsInput, type InputSuggestion } from './SettingsSuggestionsInput';
import { parseScheduleInput } from '../../utils/cronSchedule';
import { useTranslations } from 'next-intl';

// `value` is what the preset writes into the input, and `parseScheduleInput` reads
// English phrases — so only the label is translated.
const SCHEDULE_PRESETS = [
  { value: 'Every 15 minutes', labelKey: 'presetEvery15Minutes', description: '*/15 * * * *' },
  { value: 'Every hour', labelKey: 'presetEveryHour', description: '0 * * * *' },
  {
    value: 'Every weekday at 9:00 AM',
    labelKey: 'presetEveryWeekdayAt9',
    description: '0 9 * * 1-5',
  },
  { value: 'Every day at 9:00 AM', labelKey: 'presetEveryDayAt9', description: '0 9 * * *' },
] as const;

export function SettingsScheduleInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('settings.schedules');
  const result = parseScheduleInput(value);
  const messageId = useId();
  const scheduleSuggestions: InputSuggestion[] = SCHEDULE_PRESETS.map((preset) => ({
    value: preset.value,
    label: t(preset.labelKey),
    description: preset.description,
  }));

  return (
    <>
      <SettingsSuggestionsInput
        id={id}
        required
        maxLength={120}
        value={value}
        suggestions={scheduleSuggestions}
        onValueChange={onChange}
        triggerLabel={t('showPresets')}
        placeholder={t('inputPlaceholder')}
        aria-invalid={!result.ok}
        aria-describedby={messageId}
      />
      <span
        id={messageId}
        className={
          result.ok ? 'block text-xs text-muted-foreground' : 'block text-xs text-destructive'
        }
        aria-live="polite"
      >
        {result.ok ? successMessage(result, t) : result.error}
      </span>
    </>
  );
}

function successMessage(
  result: Extract<ReturnType<typeof parseScheduleInput>, { ok: true }>,
  t: ReturnType<typeof useTranslations<'settings.schedules'>>,
): React.ReactNode {
  if (result.source === 'cron') return t('runs', { description: result.description });
  return (
    <>
      {t('cronLabel')} <code className="font-mono">{result.cron}</code> ·{' '}
      {t('runsSuffix', { description: result.description })}
    </>
  );
}
