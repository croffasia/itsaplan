import { useId } from 'react';
import { SettingsSuggestionsInput, type InputSuggestion } from './SettingsSuggestionsInput';
import { useScheduleClock } from '../../hooks/useScheduleClock';
import { parseScheduleInput } from '../../utils/cronSchedule';
import { describeCronInDisplayZone } from '../../utils/cronZone';
import { useTranslations } from 'next-intl';
import DisplaySegmented from '@/components/layout/DisplaySegmented';

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

// The input takes UTC, the zone a cron runs in. The clock picked under it changes only the line
// that describes the schedule: UTC, or the zone of the user's profile.
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
  const { clock, pick } = useScheduleClock();
  const result = parseScheduleInput(value);
  // A schedule that cannot be shown on the user's clock stays in UTC, with the zone written out.
  const localTime = clock === 'local' && result.ok ? describeCronInDisplayZone(result.cron) : null;
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
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          id={messageId}
          className={result.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}
          aria-live="polite"
        >
          {result.ok ? successMessage(result, localTime, t) : result.error}
        </span>
        <div role="group" aria-label={t('clockLabel')} className="shrink-0">
          <DisplaySegmented
            value={clock}
            onChange={pick}
            options={[
              { value: 'utc', label: t('clockUtc') },
              { value: 'local', label: t('clockLocal') },
            ]}
          />
        </div>
      </div>
    </>
  );
}

function successMessage(
  result: Extract<ReturnType<typeof parseScheduleInput>, { ok: true }>,
  localTime: string | null,
  t: ReturnType<typeof useTranslations<'settings.schedules'>>,
): React.ReactNode {
  const when = localTime ?? t('runsSuffix', { description: result.description });
  if (result.source === 'cron') return t('runs', { description: when });
  return (
    <>
      {t('cronLabel')} <code className="font-mono">{result.cron}</code> · {when}
    </>
  );
}
