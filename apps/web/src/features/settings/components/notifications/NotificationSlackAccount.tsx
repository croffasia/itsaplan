'use client';

import { Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import SettingsSection from '@/components/common/page/SettingsSection';
import {
  useDisconnectSlack,
  useSlackAccountQuery,
  useStartSlackLink,
} from '../../services/slack.service';

// Where the member's Slack notifications from this project go: the account they connect
// with Sign in with Slack, in the Slack workspace of the app that serves the project.
// Hidden while Slack is off for the project.
export default function NotificationSlackAccount({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.notifications');
  const { data } = useSlackAccountQuery(projectKey);
  const start = useStartSlackLink(projectKey);
  const disconnect = useDisconnectSlack(projectKey);

  if (!data?.slackTeamName) return null;

  async function connect() {
    const { url } = await start.mutateAsync();
    window.location.assign(url);
  }

  const link = data.link;
  return (
    <SettingsSection
      title={t('slackAccount')}
      description={t('slackAccountHint', { workspace: data.slackTeamName })}
    >
      <div className="flex items-center justify-between gap-6 rounded-lg border border-border p-4 sm:max-w-md">
        <div className="flex min-w-0 items-center gap-3">
          <Hash className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm" dir="auto">
            {link ? (link.name ?? t('slackConnected')) : t('noSlackAccount')}
          </span>
        </div>
        {link ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={disconnect.isPending}
            onClick={() => void disconnect.mutateAsync()}
          >
            {t('slackDisconnect')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={start.isPending}
            onClick={() => void connect()}
          >
            {t('slackConnect')}
          </Button>
        )}
      </div>
    </SettingsSection>
  );
}
