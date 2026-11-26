'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitAccount } from '@/lib/api/endpoints/gitAccounts';
import GitHostMark from '@/components/common/git/GitHostMark';
import GitRepositories from '@/components/common/git/GitRepositories';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useDisconnectGitAccount } from '@/services/gitAccounts.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import AccountConnectButton from '../shared/AccountConnectButton';

// The user's account on a repository host. It opens on the repositories the user's projects
// sync with there.
export default function AccountGitAccountRow({ account }: { account: GitAccount }) {
  const t = useTranslations('account.accounts');
  const disconnect = useDisconnectGitAccount();
  const [open, setOpen] = useState(false);
  const { label, defaultBaseUrl } = GIT_PROVIDER_CONFIG[account.provider];
  const host = account.baseUrl === defaultBaseUrl ? null : new URL(account.baseUrl).host;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="grid grid-cols-[1rem_1rem_4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 text-sm sm:grid-cols-[1rem_1rem_5.5rem_minmax(0,1fr)_auto]"
    >
      <CollapsibleTrigger className="group/fold col-span-4 grid min-h-11 grid-cols-subgrid items-center rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ChevronRight
          className={cn(
            'size-4 text-muted-foreground transition group-hover/fold:text-foreground',
            open ? 'rotate-90' : 'rtl:rotate-180',
          )}
        />
        <GitHostMark host={account.provider} className="size-4 text-muted-foreground" />
        <span>{label}</span>
        <span dir="ltr" className="wrap-anywhere text-muted-foreground">
          {host ? `${account.accountLogin} · ${host}` : account.accountLogin}
        </span>
      </CollapsibleTrigger>
      <AccountConnectButton
        service={label}
        connected
        busy={disconnect.isPending}
        disconnectWarning={t('repositoryDisconnectWarning', { provider: label })}
        onDisconnect={async () => {
          await disconnect.mutateAsync(account.id);
          toast.success(t('repositoryAccountDisconnected'));
        }}
      />
      <CollapsibleContent className="col-span-3 col-start-3 pb-3">
        <GitRepositories source={{ accountId: account.id }} />
      </CollapsibleContent>
    </Collapsible>
  );
}
