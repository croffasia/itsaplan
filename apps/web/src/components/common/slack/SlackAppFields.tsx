import { useTranslations } from 'next-intl';
import type { SlackApp } from '@/lib/api/endpoints/slack';
import type { SlackAppForm } from '@/hooks/useSlackAppForm';
import CopyableValue from '@/components/common/page/CopyableValue';
import SecretInput from '@/components/common/inputs/SecretInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The parts of a Slack app: the bot token that sends, the client ID and secret that run
// Sign in with Slack, and the redirect URL the app lists. Secrets are sent only when typed.
export default function SlackAppFields({ app, form }: { app: SlackApp; form: SlackAppForm }) {
  const t = useTranslations('common.slackApp');
  const tCommon = useTranslations('common');
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">{t('setup')}</p>
      <div className="space-y-1.5 sm:max-w-md">
        <Label htmlFor="slack-bot-token">{t('botToken')}</Label>
        <SecretInput
          id="slack-bot-token"
          value={form.botToken}
          onChange={form.setBotToken}
          hasStored={app.hasBotToken}
          placeholder="xoxb-…"
        />
        <p className="text-xs text-muted-foreground">{t('botTokenHint')}</p>
      </div>
      <div className="space-y-1.5 sm:max-w-md">
        <Label htmlFor="slack-client-id">{t('clientId')}</Label>
        <Input
          id="slack-client-id"
          value={form.clientId}
          onChange={(e) => form.setClientId(e.target.value)}
          autoComplete="off"
          dir="ltr"
        />
      </div>
      <div className="space-y-1.5 sm:max-w-md">
        <Label htmlFor="slack-client-secret">{t('clientSecret')}</Label>
        <SecretInput
          id="slack-client-secret"
          value={form.clientSecret}
          onChange={form.setClientSecret}
          hasStored={app.hasClientSecret}
        />
      </div>
      <CopyableValue
        title={t('redirectUrl')}
        value={app.redirectUrl}
        hint={t('redirectUrlHint')}
        copyLabel={tCommon('copy')}
      />
      {app.slackTeamName && (
        <div className="space-y-1 border-t border-border/60 pt-4">
          <div className="text-sm font-medium">{t('workspace')}</div>
          <p className="text-sm" dir="auto">
            {app.slackTeamName}
          </p>
          <p className="text-xs text-muted-foreground">{t('workspaceHint')}</p>
        </div>
      )}
    </div>
  );
}
