'use client';

import { useTranslations } from 'next-intl';
import FullPageView from '@/components/common/page/FullPageView';
import AccountGitAccounts from './components/accounts/AccountGitAccounts';
import AccountGoogleConnection from './components/accounts/AccountGoogleConnection';
import { useGoogleAvailable } from './services/accounts.service';

// Google is listed only when the instance has it configured, so the page never offers a
// connection that cannot complete. Repository host accounts are always offered.
export default function AccountAccountsPage() {
  const t = useTranslations('account.accounts');
  const googleAvailable = useGoogleAvailable();

  return (
    <FullPageView label={t('label')} title={t('title')} description={t('description')}>
      <div className="divide-y">
        {googleAvailable && <AccountGoogleConnection />}
        <AccountGitAccounts />
      </div>
    </FullPageView>
  );
}
