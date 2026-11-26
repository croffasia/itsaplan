'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import GitAccountConnectDialog from '@/components/common/git/GitAccountConnectDialog';
import { Button } from '@/components/ui/button';
import { useGitAccountsQuery } from '@/services/gitAccounts.service';
import AccountListSection from '../shared/AccountListSection';
import AccountGitAccountRow from './AccountGitAccountRow';

// The user's accounts on repository hosts, one per host, and the way to add one. Their
// comments on an issue synced with a repository there are posted under it.
export default function AccountGitAccounts() {
  const t = useTranslations('account.accounts');
  const tGit = useTranslations('settings.git');
  const { data: accounts } = useGitAccountsQuery();
  const [connecting, setConnecting] = useState(false);

  return (
    <AccountListSection
      title={t('repositories')}
      description={t('repositoriesDescription')}
      help={t('repositoriesHelp')}
      actions={
        <Button
          variant="ghost"
          size="sm"
          className="-me-3"
          aria-label={tGit('accountConnectTitle')}
          onClick={() => setConnecting(true)}
        >
          {t('connect')}
        </Button>
      }
    >
      {(accounts ?? []).map((account) => (
        <AccountGitAccountRow key={account.id} account={account} />
      ))}
      <GitAccountConnectDialog open={connecting} onOpenChange={setConnecting} />
    </AccountListSection>
  );
}
