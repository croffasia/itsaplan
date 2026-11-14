'use client';

import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import {
  setDesktopNotifications,
  useDesktopNotificationsState,
} from '@/hooks/useDesktopNotifications';
import AccountPreferenceRow from './AccountPreferenceRow';

// Desktop notifications for new inbox items. Unlike the other preferences on the page,
// this one applies to the current browser only.
export default function AccountDesktopNotifications() {
  const t = useTranslations('account.preferences');
  const state = useDesktopNotificationsState();
  let description = t('desktopNotificationsDescription');
  if (state === 'blocked') description = t('desktopNotificationsBlocked');
  if (state === 'unsupported') description = t('desktopNotificationsUnsupported');

  return (
    <AccountPreferenceRow label={t('desktopNotifications')} description={description}>
      <Switch
        checked={state === 'on'}
        onCheckedChange={(on) => void setDesktopNotifications(on)}
        disabled={state === 'blocked' || state === 'unsupported'}
      />
    </AccountPreferenceRow>
  );
}
