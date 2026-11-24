import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import AccountNotificationChannelRow from './AccountNotificationChannelRow';
import AccountNotificationDesktop from './AccountNotificationDesktop';
import AccountNotificationPush from './AccountNotificationPush';
import AccountNotificationSection from './AccountNotificationSection';
import AccountNotificationSlack from './AccountNotificationSlack';
import AccountNotificationTelegram from './AccountNotificationTelegram';

// A channel the instance does not offer has no row.
export default function AccountNotificationChannels() {
  const t = useTranslations('account.notifications');
  const { data: session } = useSession();
  return (
    <AccountNotificationSection title={t('channels')}>
      <AccountNotificationChannelRow icon={Mail} name={t('email')} info={session?.user.email} />
      <AccountNotificationTelegram />
      <AccountNotificationSlack />
      <AccountNotificationPush />
      <AccountNotificationDesktop />
    </AccountNotificationSection>
  );
}
