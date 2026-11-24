import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import type { NotificationPreferences } from '@/lib/api/endpoints/notificationPreferences';
import {
  CHANNEL_EVENTS,
  NOTIFICATION_EVENTS,
  type NotificationChannel,
} from '../../utils/notificationEvents';

const CELL = 'flex flex-1 items-center justify-center sm:w-20 sm:flex-none';

export default function AccountNotificationEvents({
  name,
  value,
  channels,
  onChange,
}: {
  // Whose events these are, in the names of the checkboxes.
  name: string;
  value: NotificationPreferences;
  channels: NotificationChannel[];
  onChange: (value: NotificationPreferences) => void;
}) {
  const t = useTranslations('account.notifications');
  return (
    <div>
      <div className="flex min-h-8 items-center text-xs text-muted-foreground">
        <span className="hidden flex-1 sm:block" />
        {channels.map((channel) => (
          <span key={channel} className={CELL}>
            {t(channel)}
          </span>
        ))}
      </div>
      {NOTIFICATION_EVENTS.map((event) => (
        <div key={event} className="flex flex-wrap items-center pt-3 sm:min-h-10 sm:pt-0">
          <span className="w-full text-sm sm:w-auto sm:flex-1">{t(`events.${event}`)}</span>
          {channels.map((channel) => {
            const key = CHANNEL_EVENTS[channel];
            return (
              <span key={channel} className={`${CELL} min-h-11 sm:min-h-0`}>
                <Checkbox
                  className="relative after:absolute after:-inset-3"
                  checked={value[key][event]}
                  onCheckedChange={(on) =>
                    onChange({ ...value, [key]: { ...value[key], [event]: on === true } })
                  }
                  aria-label={`${name}: ${t(`events.${event}`)}, ${t(channel)}`}
                />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
