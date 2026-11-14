import { type ReactNode } from 'react';
import { BellRing, Mail, Send } from 'lucide-react';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { NotificationEventToggles } from '@/lib/api/endpoints/notificationSettings';
import { usePushConfigQuery } from '@/services/push.service';
import NotificationChannelHeader from './NotificationChannelHeader';
import NotificationChannelRow from './NotificationChannelRow';
import NotificationTelegramAccount from './NotificationTelegramAccount';
import { NOTIFICATION_EVENTS } from '../../utils/notificationEvents';
import type { NotificationPreferencesForm } from '../../hooks/useNotificationPreferencesForm';
import { useTranslations } from 'next-intl';

// A member's own notification preferences for the project: for each issue event, a
// checkbox per channel (email, Telegram, and push while the instance sends it). Visible
// to every member (each edits only their own). Email is sent to the account address;
// Telegram to the account connected in the member's profile, shown below; push to the
// browsers the member turned it on in. Delivery only happens for channels a project
// owner has configured. Save lives in the page header.

// Shared column templates so the header labels line up with every event row.
const COLS = 'grid grid-cols-[1fr_5rem_5rem] items-center';
const COLS_WITH_PUSH = 'grid grid-cols-[1fr_5rem_5rem_5rem] items-center';

interface Channel {
  icon: ReactNode;
  label: string;
  events: NotificationEventToggles;
  setEvents: (events: NotificationEventToggles) => void;
}

export default function NotificationPreferences({ form }: { form: NotificationPreferencesForm }) {
  const t = useTranslations('settings.notifications');
  const push = usePushConfigQuery().data?.enabled === true;
  const cols = push ? COLS_WITH_PUSH : COLS;
  const channels: Channel[] = [
    {
      icon: <Mail className="size-3.5" />,
      label: t('email'),
      events: form.emailEvents,
      setEvents: form.setEmailEvents,
    },
    {
      icon: <Send className="size-3.5" />,
      label: t('telegram'),
      events: form.telegramEvents,
      setEvents: form.setTelegramEvents,
    },
  ];
  if (push) {
    channels.push({
      icon: <BellRing className="size-3.5" />,
      label: t('push'),
      events: form.pushEvents,
      setEvents: form.setPushEvents,
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title={t('eventsTitle')}>
        <div className="max-w-xl">
          <div className={`${cols} px-3 pb-1`}>
            <span />
            {channels.map((channel) => (
              <NotificationChannelHeader
                key={channel.label}
                icon={channel.icon}
                label={channel.label}
              />
            ))}
          </div>
          <div className="flex flex-col">
            {NOTIFICATION_EVENTS.map((event) => (
              <NotificationChannelRow
                key={event}
                label={t(`events.${event}`)}
                cols={cols}
                cells={channels.map((channel) => ({
                  channel: channel.label,
                  checked: channel.events[event],
                  onChange: (value) => channel.setEvents({ ...channel.events, [event]: value }),
                }))}
              />
            ))}
          </div>
        </div>
      </SettingsSection>

      <NotificationTelegramAccount />
    </div>
  );
}
