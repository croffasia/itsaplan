'use client';

import { useTranslations } from 'next-intl';
import FullPageView from '@/components/common/page/FullPageView';
import AccountGoogleConnection from './components/accounts/AccountGoogleConnection';
import { useGoogleAvailable } from './services/accounts.service';

// A provider is only listed when the instance has it configured, so the page never
// offers a connection that cannot complete.
export default function AccountAccountsPage() {
  const t = useTranslations('account.accounts');
  const googleAvailable = useGoogleAvailable();

  return (
    <FullPageView label={t('label')} title={t('title')} description={t('description')}>
      <div className="divide-y">{googleAvailable && <AccountGoogleConnection />}</div>
    </FullPageView>
  );
}
