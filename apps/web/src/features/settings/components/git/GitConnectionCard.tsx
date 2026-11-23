import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { GitSettings } from '@/lib/api/endpoints/git';
import SettingsCard from '@/components/common/page/SettingsCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useRegenerateGitSecret } from '../../services/settings.service';
import GitCopyField from './GitCopyField';
import GithubCliCommand from './GithubCliCommand';
import GitlabCliCommand from './GitlabCliCommand';

// One tab per supported host: each takes the same payload URL and secret, but
// names the fields and the pull request trigger differently. Gitea and Forgejo
// share a tab because their webhook form is the same.
const PROVIDERS = [
  { key: 'github', label: 'GitHub', hint: 'hintGithub' },
  { key: 'gitlab', label: 'GitLab', hint: 'hintGitlab' },
  { key: 'gitea', label: 'Gitea / Forgejo', hint: 'hintGitea' },
  { key: 'bitbucket', label: 'Bitbucket', hint: 'hintBitbucket' },
] as const;

type ProviderKey = (typeof PROVIDERS)[number]['key'];

// The tab to open first: the host the newest delivery came from, so a connected
// project shows its own instructions.
function initialTab(provider: string | undefined): ProviderKey {
  const seen = provider?.toLowerCase();
  if (seen === 'forgejo') return 'gitea';
  return PROVIDERS.find((p) => p.key === seen)?.key ?? 'github';
}

// The webhook made by hand, for a repository no provider account can reach. Collapsed:
// a repository connected through an account needs none of it.
export default function GitConnectionCard({
  projectKey,
  settings,
}: {
  projectKey: string;
  settings: GitSettings;
}) {
  const t = useTranslations('settings.git');
  const regenerate = useRegenerateGitSecret(projectKey);
  const [tab, setTab] = useState<ProviderKey>(() => initialTab(settings.repositories[0]?.provider));

  async function regenerateSecret() {
    await regenerate.mutateAsync();
    toast.success(t('secretRegenerated'));
  }

  const regenerateAction = (
    <Button
      variant="ghost"
      size="sm"
      disabled={regenerate.isPending}
      onClick={() => void regenerateSecret()}
    >
      {t('regenerate')}
    </Button>
  );

  const hint = (key: (typeof PROVIDERS)[number]['hint']) => (
    <p className="text-xs text-muted-foreground">
      {t.rich(key, {
        b: (chunks) => <b>{chunks}</b>,
        code: (chunks) => <code className="rounded bg-muted px-1 py-0.5">{chunks}</code>,
      })}
    </p>
  );

  return (
    <details className="group">
      <summary className="cursor-pointer list-none select-none marker:content-none">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <span className="transition-transform group-open:rotate-90">›</span>
          {t('manualSetup')}
        </span>
        <p className="ms-5 mt-1 text-xs text-muted-foreground">{t('manualSetupHint')}</p>
      </summary>
      <SettingsCard className="mt-4 divide-y divide-border/60">
        <div className="space-y-4 p-4">
          <GitCopyField label={t('payloadUrl')} value={settings.payloadUrl} />
          <GitCopyField
            label={t('webhookSecret')}
            value={settings.secret}
            masked
            action={regenerateAction}
          />
        </div>
        <div className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ProviderKey)}>
            <TabsList variant="line">
              {PROVIDERS.map((p) => (
                <TabsTrigger key={p.key} value={p.key}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {PROVIDERS.map((p) => (
              <TabsContent key={p.key} value={p.key} className="mt-4 space-y-4">
                {hint(p.hint)}
                {p.key === 'github' && (
                  <GithubCliCommand payloadUrl={settings.payloadUrl} secret={settings.secret} />
                )}
                {p.key === 'gitlab' && (
                  <GitlabCliCommand payloadUrl={settings.payloadUrl} secret={settings.secret} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SettingsCard>
    </details>
  );
}
