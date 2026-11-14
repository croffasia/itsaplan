'use client';

import { useTranslations } from 'next-intl';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import { Switch } from '@/components/ui/switch';
import { useAccountPushDevice } from '../../hooks/useAccountPushDevice';
import AccountPreferenceRow from './AccountPreferenceRow';

export default function AccountPushNotifications() {
  const t = useTranslations('account.preferences');
  const { state, pending, setOn } = useAccountPushDevice();
  if (state === 'hidden') return null;

  let description = t('pushNotificationsDescription');
  if (state === 'blocked') description = t('pushNotificationsBlocked');
  if (state === 'unsupported') description = t('pushNotificationsUnsupported');
  if (state === 'unsupportedIos') description = t('pushNotificationsUnsupportedIos');
  const locked = state === 'blocked' || state === 'unsupported' || state === 'unsupportedIos';

  return (
    <AccountPreferenceRow label={t('pushNotifications')} description={description}>
      {locked ? (
        <OnOffStatus on={false}>{t('pushNotificationsOff')}</OnOffStatus>
      ) : (
        <Switch
          checked={state === 'on'}
          disabled={state === 'loading' || pending}
          onCheckedChange={(on) => void setOn(on)}
        />
      )}
    </AccountPreferenceRow>
  );
}
