import {
  Check,
  CirclePlus,
  ClipboardList,
  Clock,
  Lock,
  Merge,
  MessageSquare,
  SquareKanban,
  Tag,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AgentScheduleType } from '@/lib/api/endpoints/agentSchedules';
import UpgradeToProButton from '@/components/common/UpgradeToProButton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { proUrl } from '@/utils/app';
import { SettingsScheduleField } from './SettingsScheduleField';
import { useTranslations } from 'next-intl';

// What the editions that start schedules on more events add, as a group of its own. Each opens
// the page about them: items rather than links, so the keyboard reaches them too.
const MORE = 'more:';

const LOCKED: Record<'issue' | 'request', { key: string; icon: LucideIcon }[]> = {
  issue: [
    { key: 'issue.created', icon: CirclePlus },
    { key: 'issue.assigned', icon: UserRound },
    { key: 'issue.label_added', icon: Tag },
    { key: 'comment.created', icon: MessageSquare },
  ],
  request: [
    { key: 'request.received', icon: ClipboardList },
    { key: 'request.accepted', icon: Check },
    { key: 'request.merged', icon: Merge },
    { key: 'request.declined', icon: X },
  ],
};

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
          if (next.startsWith(MORE)) window.open(proUrl('schedules'), '_blank', 'noreferrer');
          else onChange(next as AgentScheduleType);
        }}
      >
        <SelectTrigger id="schedule-type" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cron">
            <Clock />
            {t('types.cron')}
          </SelectItem>
          <SelectItem value="status">
            <SquareKanban />
            {t('types.status')}
          </SelectItem>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5" />
                {t('moreTypes')}
              </span>
              <UpgradeToProButton feature="schedules" className="h-7 px-2.5 text-xs" />
            </SelectLabel>
          </SelectGroup>
          {(['issue', 'request'] as const).map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{t(`groups.${group}`)}</SelectLabel>
              {LOCKED[group].map(({ key, icon: Icon }) => (
                <SelectItem key={key} value={`${MORE}${key}`} className="text-muted-foreground">
                  <Icon />
                  {t(`events.${key}` as Parameters<typeof t>[0])}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </SettingsScheduleField>
  );
}
