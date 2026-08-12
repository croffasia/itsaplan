import { formatDistanceToNow, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { API_URL, type GithubSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useRegenerateGithubSecret } from '../../services/settings.service';
import GithubCopyField from './GithubCopyField';
import GithubCliCommand from './GithubCliCommand';

// The Connection block: how to register the webhook on the GitHub repository —
// one command with the GitHub CLI, or the values to paste into GitHub's webhook
// form — plus the most recent delivery.
export default function GithubConnectionCard({
  projectKey,
  settings,
  editable,
}: {
  projectKey: string;
  settings: GithubSettings;
  editable: boolean;
}) {
  const t = useTranslations('settings.github');
  const locale = useDateFnsLocale();
  const regenerate = useRegenerateGithubSecret(projectKey);
  const payloadUrl = `${API_URL}/webhooks/github/${settings.webhookId}`;

  function lastDeliveryText() {
    if (!settings.lastEventAt) return t('noDelivery');
    const ago = formatDistanceToNow(parseISO(settings.lastEventAt), { addSuffix: true, locale });
    return settings.lastEventRepo
      ? t('lastDeliveryFrom', { ago, repo: settings.lastEventRepo })
      : t('lastDeliveryAt', { ago });
  }

  async function regenerateSecret() {
    await regenerate.mutateAsync();
    toast.success(t('secretRegenerated'));
  }

  return (
    <SettingsSection title={t('connection')} description={t('connectionHint')}>
      <SettingsCard className="divide-y divide-border/60">
        {settings.secret == null ? (
          <p className="p-4 text-xs text-muted-foreground">{t('connectionRestricted')}</p>
        ) : (
          <Tabs defaultValue="cli" className="p-4">
            <TabsList variant="line">
              <TabsTrigger value="cli">{t('tabCli')}</TabsTrigger>
              <TabsTrigger value="manual">{t('tabManual')}</TabsTrigger>
            </TabsList>
            <TabsContent value="cli" className="mt-4">
              <GithubCliCommand payloadUrl={payloadUrl} secret={settings.secret} />
            </TabsContent>
            <TabsContent value="manual" className="mt-4 space-y-4">
              <GithubCopyField label={t('payloadUrl')} value={payloadUrl} />
              <GithubCopyField
                label={t('webhookSecret')}
                value={settings.secret}
                masked
                action={
                  editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={regenerate.isPending}
                      onClick={() => void regenerateSecret()}
                    >
                      {t('regenerate')}
                    </Button>
                  ) : undefined
                }
              />
              <p className="text-xs text-muted-foreground">
                {t.rich('manualHint', {
                  b: (chunks) => <b>{chunks}</b>,
                  code: (chunks) => <code className="rounded bg-muted px-1 py-0.5">{chunks}</code>,
                })}
              </p>
            </TabsContent>
          </Tabs>
        )}
        <SettingsRow
          title={t('lastDelivery')}
          description={lastDeliveryText()}
          control={<span />}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
