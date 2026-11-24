'use client';

import type { ProjectNotificationPreferences } from '@/lib/api/endpoints/notificationPreferences';
import { usePushConfigQuery, usePushDevicesQuery } from '../services/push.service';
import { useSlackAccountsQuery } from '../services/slack.service';
import { useTelegramAccountQuery } from '../services/telegram.service';
import type { NotificationChannel } from '../utils/notificationEvents';

// The channels that reach the user: email always, the rest while they are connected. Slack
// reaches a project only in the Slack workspace the project sends to.
export function useAccountNotificationChannels() {
  const telegram = useTelegramAccountQuery();
  const slack = useSlackAccountsQuery();
  const push = usePushConfigQuery();
  const pushOn = push.data?.enabled === true;
  const devices = usePushDevicesQuery(pushOn);

  const slackTeamIds = (slack.data ?? []).flatMap((account) =>
    account.link && account.available ? [account.slackTeamId] : [],
  );
  const channels: NotificationChannel[] = ['email'];
  if (telegram.data?.link) channels.push('telegram');
  if (slackTeamIds.length > 0) channels.push('slack');
  if (pushOn && devices.data && devices.data.length > 0) channels.push('push');

  return {
    pending:
      telegram.isPending || slack.isPending || push.isPending || (pushOn && devices.isPending),
    channels,
    channelsOf: ({ slackTeamId }: ProjectNotificationPreferences) =>
      channels.filter(
        (channel) =>
          channel !== 'slack' || (slackTeamId !== null && slackTeamIds.includes(slackTeamId)),
      ),
  };
}
