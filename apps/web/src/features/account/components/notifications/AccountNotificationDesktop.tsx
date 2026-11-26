'use client';

import { Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import { Switch } from '@/components/ui/switch';
import {
  setDesktopNotifications,
  useDesktopNotificationsState,
} from '@/hooks/useDesktopNotifications';
import AccountServiceRow from '../shared/AccountServiceRow';

export default function AccountNotificationDesktop() {
  const t = useTranslations('account.notifications');
  const state = useDesktopNotificationsState();
  let info = t('desktopDescription');
  if (state === 'blocked') info = t('browserBlocked');
  if (state === 'unsupported') info = t('desktopUnsupported');
  if (state === 'push') info = t('desktopReplacedByPush');

  return (
    <AccountServiceRow icon={<Monitor />} name={t('desktop')} info={info}>
      {(state === 'blocked' || state === 'unsupported') && (
        <OnOffStatus on={false}>{t('off')}</OnOffStatus>
      )}
      {(state === 'on' || state === 'off') && (
        <Switch
          checked={state === 'on'}
          onCheckedChange={(on) => void setDesktopNotifications(on)}
          aria-label={t('desktopNotifications')}
        />
      )}
    </AccountServiceRow>
  );
}
