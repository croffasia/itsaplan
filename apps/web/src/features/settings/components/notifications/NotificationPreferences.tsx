import { type ReactNode } from 'react';
import { Bell, Mail, Send } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import SettingsSection from '@/components/common/page/SettingsSection';
import NotificationTelegramAccount from './NotificationTelegramAccount';
import { NOTIFICATION_EVENTS } from '../../utils/notificationEvents';
import type { NotificationPreferencesForm } from '../../hooks/useNotificationPreferencesForm';
import { useTranslations } from 'next-intl';

// A member's own notification preferences for the project: for each issue event, a
// checkbox per channel (email, Telegram, Apprise). Visible to every member (each edits only
// their own). Email is sent to the account address; Telegram to the account connected
// in the member's profile, shown below; Apprise to the team's Apprise API. Delivery only happens for channels a project
// owner has configured. Save lives in the page header.

// Shared column template so the header labels line up with every event row.
const COLS = 'grid grid-cols-[1fr_5rem_5rem_5rem] items-center';

export default function NotificationPreferences({ form }: { form: NotificationPreferencesForm }) {
  const t = useTranslations('settings.notifications');
  const { emailEvents, setEmailEvents, telegramEvents, setTelegramEvents } = form;
  const { appriseEvents, setAppriseEvents } = form;
  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title={t('eventsTitle')}>
        <div className="max-w-xl">
          <div className={`${COLS} px-3 pb-1`}>
            <span />
            <ChannelHeader icon={<Mail className="size-3.5" />} label={t('email')} />
            <ChannelHeader icon={<Send className="size-3.5" />} label={t('telegram')} />
            <ChannelHeader icon={<Bell className="size-3.5" />} label={t('apprise')} />
          </div>
          <div className="flex flex-col">
            {NOTIFICATION_EVENTS.map((event) => (
              <ChannelRow
                key={event}
                label={t(`events.${event}`)}
                emailChecked={emailEvents[event]}
                telegramChecked={telegramEvents[event]}
                appriseChecked={appriseEvents[event]}
                onEmail={(v) => setEmailEvents({ ...emailEvents, [event]: v })}
                onTelegram={(v) => setTelegramEvents({ ...telegramEvents, [event]: v })}
                onApprise={(v) => setAppriseEvents({ ...appriseEvents, [event]: v })}
              />
            ))}
          </div>
        </div>
      </SettingsSection>

      <NotificationTelegramAccount />
    </div>
  );
}

function ChannelHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function ChannelRow({
  label,
  emailChecked,
  telegramChecked,
  appriseChecked,
  onEmail,
  onTelegram,
  onApprise,
}: {
  label: string;
  emailChecked: boolean;
  telegramChecked: boolean;
  appriseChecked: boolean;
  onEmail: (value: boolean) => void;
  onTelegram: (value: boolean) => void;
  onApprise: (value: boolean) => void;
}) {
  return (
    <div className={`${COLS} -mx-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent`}>
      <span className="text-sm">{label}</span>
      <div className="flex justify-center">
        <Checkbox
          checked={emailChecked}
          onCheckedChange={(v) => onEmail(v === true)}
          aria-label={`${label} — email`}
        />
      </div>
      <div className="flex justify-center">
        <Checkbox
          checked={telegramChecked}
          onCheckedChange={(v) => onTelegram(v === true)}
          aria-label={`${label} — Telegram`}
        />
      </div>
      <div className="flex justify-center">
        <Checkbox
          checked={appriseChecked}
          onCheckedChange={(v) => onApprise(v === true)}
          aria-label={`${label} — Apprise`}
        />
      </div>
    </div>
  );
}
