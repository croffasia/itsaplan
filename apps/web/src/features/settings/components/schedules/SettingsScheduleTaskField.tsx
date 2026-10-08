import { Textarea } from '@/components/ui/textarea';
import { SettingsScheduleField } from './SettingsScheduleField';
import { useTranslations } from 'next-intl';

// A run on an issue already names the issue and what happened to it, so the task of a
// schedule that is not a cron is optional.
export function SettingsScheduleTaskField({
  optional,
  value,
  onChange,
}: {
  optional: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('settings.schedules');
  return (
    <SettingsScheduleField htmlFor="schedule-task" label={optional ? t('taskOptional') : t('task')}>
      <Textarea
        id="schedule-task"
        required={!optional}
        maxLength={20_000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={optional ? t('issueTaskPlaceholder') : t('taskPlaceholder')}
        className="min-h-32 resize-y"
      />
      <p className="text-xs text-muted-foreground">
        {optional ? t('issueTaskHint') : t('taskHint')}
      </p>
    </SettingsScheduleField>
  );
}
