'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  useDisconnectSlack,
  useSlackAccountsQuery,
  useStartSlackLink,
} from '../../services/slack.service';
import { rememberSlackReturn } from '../../utils/slackReturn';
import AccountConnectButton from './AccountConnectButton';
import AccountServiceRow from './AccountServiceRow';

// The user's Slack accounts: a row for each Slack workspace their projects send to, and
// for each they are still connected to. Connecting leaves for Sign in with Slack.
export default function AccountSlackRows({ icon }: { icon: ReactNode }) {
  const t = useTranslations('account.notifications');
  const tAccounts = useTranslations('account.accounts');
  const { data: accounts } = useSlackAccountsQuery();
  const start = useStartSlackLink();
  const disconnect = useDisconnectSlack();

  function connect(slackTeamId: string) {
    start.mutate(slackTeamId, {
      onSuccess: ({ url }) => {
        rememberSlackReturn();
        window.location.assign(url);
      },
    });
  }

  return accounts?.map(({ slackTeamId, slackTeamName, link }) => {
    const workspace = slackTeamName ?? t('slack');
    return (
      <AccountServiceRow
        key={slackTeamId}
        icon={icon}
        name={t('slack')}
        info={
          link
            ? t('slackLinked', { name: link.name ?? tAccounts('connected'), workspace })
            : t('slackNotConnected', { workspace })
        }
      >
        <AccountConnectButton
          service={t('slack')}
          connected={link !== null}
          busy={start.isPending || disconnect.isPending}
          disconnectWarning={tAccounts('slackDisconnectWarning', { workspace })}
          onConnect={() => connect(slackTeamId)}
          onDisconnect={() => disconnect.mutateAsync(slackTeamId)}
        />
      </AccountServiceRow>
    );
  });
}
