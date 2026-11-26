'use client';

import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import { Switch } from '@/components/ui/switch';
import { useAccountPushDevice } from '../../hooks/useAccountPushDevice';
import AccountServiceRow from '../shared/AccountServiceRow';

export default function AccountNotificationPush() {
  const t = useTranslations('account.notifications');
  const { state, pending, setOn } = useAccountPushDevice();
  if (state === 'hidden') return null;

  let info = t('pushDescription');
  if (state === 'blocked') info = t('browserBlocked');
  if (state === 'unsupported') info = t('pushUnsupported');
  if (state === 'unsupportedIos') info = t('pushUnsupportedIos');
  const locked = state === 'blocked' || state === 'unsupported' || state === 'unsupportedIos';

  return (
    <AccountServiceRow icon={<BellRing />} name={t('push')} info={info}>
      {locked ? (
        <OnOffStatus on={false}>{t('off')}</OnOffStatus>
      ) : (
        <Switch
          checked={state === 'on'}
          disabled={state === 'loading' || pending}
          onCheckedChange={(on) => void setOn(on)}
          aria-label={t('pushNotifications')}
        />
      )}
    </AccountServiceRow>
  );
}
