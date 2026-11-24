import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type {
  NotificationPreferences,
  ProjectNotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
import { isOff, type NotificationChannel } from '../../utils/notificationEvents';
import AccountNotificationEvents from './AccountNotificationEvents';
import AccountNotificationFold from './AccountNotificationFold';

// Changing a checkbox of a project that follows the defaults gives it settings of its own.
export default function AccountNotificationProject({
  project,
  defaults,
  channels,
  onChange,
  onUseDefaults,
}: {
  project: ProjectNotificationPreferences;
  defaults: NotificationPreferences;
  channels: NotificationChannel[];
  onChange: (preferences: NotificationPreferences) => void;
  onUseDefaults: () => void;
}) {
  const t = useTranslations('account.notifications');
  const own = project.preferences;
  let mark: string | undefined;
  if (own) mark = isOff(own, channels) ? t('off') : t('custom');
  return (
    <AccountNotificationFold
      title={project.name}
      closedMark={mark}
      openClassName="my-1 bg-muted/40"
    >
      <AccountNotificationEvents
        name={project.name}
        value={own ?? defaults}
        channels={channels}
        onChange={onChange}
      />
      {own && (
        <div className="-me-3 mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('useDefaultsFor', { project: project.name })}
            onClick={onUseDefaults}
          >
            {t('useDefaults')}
          </Button>
        </div>
      )}
    </AccountNotificationFold>
  );
}
