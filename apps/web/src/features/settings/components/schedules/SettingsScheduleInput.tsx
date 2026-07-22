import { useId } from 'react';
import { SettingsSuggestionsInput, type InputSuggestion } from './SettingsSuggestionsInput';
import { parseScheduleInput } from '../../utils/cronSchedule';

const scheduleSuggestions: InputSuggestion[] = [
  { value: 'Every 15 minutes', label: 'Every 15 minutes', description: '*/15 * * * *' },
  { value: 'Every hour', label: 'Every hour', description: '0 * * * *' },
  {
    value: 'Every weekday at 9:00 AM',
    label: 'Every weekday at 9:00 AM',
    description: '0 9 * * 1-5',
  },
  { value: 'Every day at 9:00 AM', label: 'Every day at 9:00 AM', description: '0 9 * * *' },
];

export function SettingsScheduleInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const result = parseScheduleInput(value);
  const messageId = useId();

  return (
    <>
      <SettingsSuggestionsInput
        id={id}
        required
        maxLength={120}
        value={value}
        suggestions={scheduleSuggestions}
        onValueChange={onChange}
        triggerLabel="Show preset schedules"
        placeholder="Every weekday at 9:00 AM or 0 9 * * 1-5"
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
        {result.ok ? successMessage(result) : result.error}
      </span>
    </>
  );
}

function successMessage(
  result: Extract<ReturnType<typeof parseScheduleInput>, { ok: true }>,
): React.ReactNode {
  if (result.source === 'cron') return `Runs: ${result.description} UTC`;
  return (
    <>
      Cron: <code className="font-mono">{result.cron}</code> · {result.description} UTC
    </>
  );
}
