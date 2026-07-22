import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Mail, Send } from 'lucide-react';
import type { NotificationEventToggles, NotificationPreferences as Prefs } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferences,
} from '../../services/settings.service';
import SettingsSection from '@/components/common/page/SettingsSection';
import NotificationTelegramAccount from './NotificationTelegramAccount';
import { NOTIFICATION_EVENTS, eventsEqual } from '../../utils/notificationEvents';

// A member's own notification preferences for the project: for each issue event, a
// checkbox per channel (email, Telegram). Visible to every member (each edits only
// their own). Email is sent to the account address; Telegram to the account connected
// in the member's profile, shown below. Delivery only happens for channels a project
// owner has configured.
export default function NotificationPreferences({ projectKey }: { projectKey: string }) {
  const query = useNotificationPreferencesQuery(projectKey);
  if (!query.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  return <PreferencesForm projectKey={projectKey} initial={query.data} />;
}

// Shared column template so the header labels line up with every event row.
const COLS = 'grid grid-cols-[1fr_5rem_5rem] items-center';

function PreferencesForm({ projectKey, initial }: { projectKey: string; initial: Prefs }) {
  const update = useUpdateNotificationPreferences(projectKey);
  const [emailEvents, setEmailEvents] = useState<NotificationEventToggles>(initial.emailEvents);
  const [telegramEvents, setTelegramEvents] = useState<NotificationEventToggles>(
    initial.telegramEvents,
  );

  const dirty =
    !eventsEqual(emailEvents, initial.emailEvents) ||
    !eventsEqual(telegramEvents, initial.telegramEvents);

  async function save() {
    await update.mutateAsync({ emailEvents, telegramEvents });
    toast.success('Notification preferences saved');
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsSection
        title="Events"
        description="Pick a channel for each event. A channel only sends once an admin has set it up for the project."
      >
        <div className="max-w-xl">
          <div className={`${COLS} px-3 pb-1`}>
            <span />
            <ChannelHeader icon={<Mail className="size-3.5" />} label="Email" />
            <ChannelHeader icon={<Send className="size-3.5" />} label="Telegram" />
          </div>
          <div className="flex flex-col">
            {NOTIFICATION_EVENTS.map((event) => (
              <ChannelRow
                key={event.key}
                label={event.label}
                emailChecked={emailEvents[event.key]}
                telegramChecked={telegramEvents[event.key]}
                onEmail={(v) => setEmailEvents({ ...emailEvents, [event.key]: v })}
                onTelegram={(v) => setTelegramEvents({ ...telegramEvents, [event.key]: v })}
              />
            ))}
          </div>
        </div>
      </SettingsSection>

      <NotificationTelegramAccount />

      <div className="flex items-center justify-end gap-4 border-t border-border pt-6">
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <Button onClick={save} disabled={!dirty || update.isPending}>
          Save changes
        </Button>
      </div>
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
  onEmail,
  onTelegram,
}: {
  label: string;
  emailChecked: boolean;
  telegramChecked: boolean;
  onEmail: (value: boolean) => void;
  onTelegram: (value: boolean) => void;
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
    </div>
  );
}
