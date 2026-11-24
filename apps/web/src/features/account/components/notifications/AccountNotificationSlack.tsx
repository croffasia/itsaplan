'use client';

import { Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useDisconnectSlack,
  useSlackAccountsQuery,
  useStartSlackLink,
} from '../../services/slack.service';
import AccountNotificationChannelRow from './AccountNotificationChannelRow';
import AccountNotificationConnectButton from './AccountNotificationConnectButton';

// The user's Slack accounts: a row for each Slack workspace their projects send to, and
// for each they are still connected to. Connecting leaves for Sign in with Slack.
export default function AccountNotificationSlack() {
  const t = useTranslations('account.notifications');
  const tAccounts = useTranslations('account.accounts');
  const { data: accounts } = useSlackAccountsQuery();
  const start = useStartSlackLink();
  const disconnect = useDisconnectSlack();

  function connect(slackTeamId: string) {
    start.mutate(slackTeamId, { onSuccess: ({ url }) => window.location.assign(url) });
  }

  return accounts?.map(({ slackTeamId, slackTeamName, link }) => {
    const workspace = slackTeamName ?? t('slack');
    return (
      <AccountNotificationChannelRow
        key={slackTeamId}
        icon={Hash}
        name={t('slack')}
        info={
          link
            ? t('slackLinked', { name: link.name ?? tAccounts('connected'), workspace })
            : t('slackNotConnected', { workspace })
        }
      >
        <AccountNotificationConnectButton
          channel={t('slack')}
          connected={link !== null}
          busy={start.isPending || disconnect.isPending}
          onConnect={() => connect(slackTeamId)}
          onDisconnect={() => disconnect.mutate(slackTeamId)}
        />
      </AccountNotificationChannelRow>
    );
  });
}
