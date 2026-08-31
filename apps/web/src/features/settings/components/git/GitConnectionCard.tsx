import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { API_URL, type GitSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
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

// The Connection block: how to register the webhook on a repository, and which
// repositories have delivered so far.
export default function GitConnectionCard({
  projectKey,
  settings,
  editable,
}: {
  projectKey: string;
  settings: GitSettings;
  editable: boolean;
}) {
  const t = useTranslations('settings.git');
  const regenerate = useRegenerateGitSecret(projectKey);
  const [tab, setTab] = useState<ProviderKey>(() => initialTab(settings.repositories[0]?.provider));
  const payloadUrl = `${API_URL}/webhooks/git/${settings.webhookId}`;
  // Null for a member who may read but not edit integrations.
  const secret = settings.secret;

  async function regenerateSecret() {
    await regenerate.mutateAsync();
    toast.success(t('secretRegenerated'));
  }

  const regenerateAction = editable ? (
    <Button
      variant="ghost"
      size="sm"
      disabled={regenerate.isPending}
      onClick={() => void regenerateSecret()}
    >
      {t('regenerate')}
    </Button>
  ) : undefined;

  const hint = (key: (typeof PROVIDERS)[number]['hint']) => (
    <p className="text-xs text-muted-foreground">
      {t.rich(key, {
        b: (chunks) => <b>{chunks}</b>,
        code: (chunks) => <code className="rounded bg-muted px-1 py-0.5">{chunks}</code>,
      })}
    </p>
  );

  return (
    <SettingsSection title={t('webhookEndpoint')} description={t('webhookEndpointHint')}>
      <SettingsCard className="divide-y divide-border/60">
        {secret == null ? (
          <p className="p-4 text-xs text-muted-foreground">{t('connectionRestricted')}</p>
        ) : (
          <>
            {/* One URL and one secret serve every host — they sit above the tabs,
                which carry nothing but each host's instructions. */}
            <div className="space-y-4 p-4">
              <GitCopyField label={t('payloadUrl')} value={payloadUrl} />
              <GitCopyField
                label={t('webhookSecret')}
                value={secret}
                masked
                action={regenerateAction}
              />
            </div>
            <details className="group p-4">
              <summary className="cursor-pointer list-none text-sm font-medium select-none marker:content-none">
                <span className="inline-flex items-center gap-2">
                  <span className="transition-transform group-open:rotate-90">›</span>
                  {t('manualSetup')}
                </span>
              </summary>
              <div className="mt-4">
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
                        <GithubCliCommand payloadUrl={payloadUrl} secret={secret} />
                      )}
                      {p.key === 'gitlab' && (
                        <GitlabCliCommand payloadUrl={payloadUrl} secret={secret} />
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </details>
          </>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}
