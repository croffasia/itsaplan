import { Hash, Mail, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import AccountNotificationDesktop from './AccountNotificationDesktop';
import AccountNotificationPush from './AccountNotificationPush';
import AccountListSection from '../shared/AccountListSection';
import AccountServiceRow from '../shared/AccountServiceRow';
import AccountSlackRows from '../shared/AccountSlackRows';
import AccountTelegramRow from '../shared/AccountTelegramRow';

// A channel the instance does not offer has no row.
export default function AccountNotificationChannels() {
  const t = useTranslations('account.notifications');
  const { data: session } = useSession();
  return (
    <AccountListSection title={t('channels')}>
      <AccountServiceRow icon={<Mail />} name={t('email')} info={session?.user.email} />
      <AccountTelegramRow icon={<Send />} />
      <AccountSlackRows icon={<Hash />} />
      <AccountNotificationPush />
      <AccountNotificationDesktop />
    </AccountListSection>
  );
}
