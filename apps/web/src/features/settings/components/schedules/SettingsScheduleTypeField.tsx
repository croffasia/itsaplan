import type { AgentScheduleType } from '@/lib/api/endpoints/agentSchedules';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsScheduleField } from './SettingsScheduleField';
import { useTranslations } from 'next-intl';

export function SettingsScheduleTypeField({
  value,
  onChange,
}: {
  value: AgentScheduleType;
  onChange: (value: AgentScheduleType) => void;
}) {
  const t = useTranslations('settings.schedules');
  return (
    <SettingsScheduleField htmlFor="schedule-type" label={t('type')}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="schedule-type" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cron">{t('types.cron')}</SelectItem>
          <SelectItem value="status">{t('types.status')}</SelectItem>
        </SelectContent>
      </Select>
    </SettingsScheduleField>
  );
}
