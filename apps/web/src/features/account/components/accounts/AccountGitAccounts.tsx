'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import GitAccountConnectDialog from '@/components/common/git/GitAccountConnectDialog';
import GitHostMark from '@/components/common/git/GitHostMark';
import { useDisconnectGitAccount, useGitAccountsQuery } from '@/services/gitAccounts.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import AccountConnectionRow from './AccountConnectionRow';

// The user's accounts on repository hosts, one per host, and the way to add one. Their
// comments on an issue synced with a repository there are posted under it.
export default function AccountGitAccounts() {
  const t = useTranslations('account.accounts');
  const { data: accounts } = useGitAccountsQuery();
  const disconnect = useDisconnectGitAccount();
  const [connecting, setConnecting] = useState(false);

  return (
    <>
      {(accounts ?? []).map((account) => (
        <AccountConnectionRow
          key={account.id}
          icon={<GitHostMark host={account.provider} className="size-4" />}
          name={GIT_PROVIDER_CONFIG[account.provider].label}
          description=""
          connectedTo={`${account.accountLogin} · ${new URL(account.baseUrl).host}`}
          busy={disconnect.isPending}
          onConnect={() => setConnecting(true)}
          onDisconnect={() =>
            disconnect.mutate(account.id, {
              onSuccess: () => toast.success(t('repositoryAccountDisconnected')),
            })
          }
        />
      ))}
      <AccountConnectionRow
        icon={<GitBranch className="size-4" />}
        name={t('repositoryAccount')}
        description={t('repositoryAccountDescription')}
        connectedTo={null}
        busy={false}
        onConnect={() => setConnecting(true)}
        onDisconnect={() => undefined}
      />
      <GitAccountConnectDialog open={connecting} onOpenChange={setConnecting} />
    </>
  );
}
