'use client';

import { useTranslations } from 'next-intl';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import { Switch } from '@/components/ui/switch';
import {
  setDesktopNotifications,
  useDesktopNotificationsState,
} from '@/hooks/useDesktopNotifications';
import AccountPreferenceRow from './AccountPreferenceRow';

export default function AccountDesktopNotifications() {
  const t = useTranslations('account.preferences');
  const state = useDesktopNotificationsState();
  let description = t('desktopNotificationsDescription');
  if (state === 'blocked') description = t('desktopNotificationsBlocked');
  if (state === 'unsupported') description = t('desktopNotificationsUnsupported');

  return (
    <AccountPreferenceRow label={t('desktopNotifications')} description={description}>
      {state === 'blocked' || state === 'unsupported' ? (
        <OnOffStatus on={false}>{t('desktopNotificationsOff')}</OnOffStatus>
      ) : (
        <Switch
          checked={state === 'on'}
          onCheckedChange={(on) => void setDesktopNotifications(on)}
        />
      )}
    </AccountPreferenceRow>
  );
}
