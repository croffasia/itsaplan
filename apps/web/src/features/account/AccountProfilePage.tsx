'use client';

import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import FullPageView from '@/components/common/page/FullPageView';
import AccountProfileAvatar from './components/profile/AccountProfileAvatar';
import AccountProfileDetailsForm from './components/profile/AccountProfileDetailsForm';
import AccountSection from './components/AccountSection';

export default function AccountProfilePage() {
  const t = useTranslations('account.profile');
  const { data: session } = useSession();

  return (
    <FullPageView
      label={t('label')}
      title={t('title')}
      description={t('description', { email: session?.user.email ?? '…' })}
    >
      <AccountSection title={t('avatarTitle')} description={t('avatarDescription')}>
        <AccountProfileAvatar />
      </AccountSection>
      <AccountSection title={t('detailsTitle')} description={t('detailsDescription')}>
        <AccountProfileDetailsForm />
      </AccountSection>
    </FullPageView>
  );
}
