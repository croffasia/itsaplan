import { ExternalLink, Lock } from 'lucide-react';
import type { AgentScheduleType } from '@/lib/api/endpoints/agentSchedules';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRO_URL } from '@/utils/app';
import { SettingsScheduleField } from './SettingsScheduleField';
import { useTranslations } from 'next-intl';

// The last item opens the page about Cloud and Pro, which start schedules on more
// events. An item rather than a link, so the keyboard reaches it too.
const MORE = 'more';

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
      <Select
        value={value}
        onValueChange={(next) => {
          if (next === MORE) window.open(PRO_URL, '_blank', 'noreferrer');
          else onChange(next as AgentScheduleType);
        }}
      >
        <SelectTrigger id="schedule-type" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cron">{t('types.cron')}</SelectItem>
          <SelectItem value="status">{t('types.status')}</SelectItem>
          <SelectSeparator />
          <SelectItem value={MORE}>
            <Lock />
            <span className="flex flex-col">
              {t('moreTypes')}
              <span className="text-xs text-muted-foreground">{t('moreTypesHint')}</span>
            </span>
            <ExternalLink />
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingsScheduleField>
  );
}
