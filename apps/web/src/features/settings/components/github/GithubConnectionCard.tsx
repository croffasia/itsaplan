import { formatDistanceToNow, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { API_URL, type GithubSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  const regenerate = useRegenerateGithubSecret(projectKey);
  const payloadUrl = `${API_URL}/webhooks/github/${settings.webhookId}`;

  async function regenerateSecret() {
    await regenerate.mutateAsync();
    toast.success('New secret created. Update it in your GitHub webhook too.');
  }

  return (
    <SettingsSection title="Connection" description="Connect a GitHub repository to this project.">
      <SettingsCard className="divide-y divide-border/60">
        {settings.secret == null ? (
          <p className="p-4 text-xs text-muted-foreground">
            Only members who can edit integrations can see the connection details.
          </p>
        ) : (
          <Tabs defaultValue="cli" className="p-4">
            <TabsList variant="line">
              <TabsTrigger value="cli">GitHub CLI</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>
            <TabsContent value="cli" className="mt-4">
              <GithubCliCommand payloadUrl={payloadUrl} secret={settings.secret} />
            </TabsContent>
            <TabsContent value="manual" className="mt-4 space-y-4">
              <GithubCopyField label="Payload URL" value={payloadUrl} />
              <GithubCopyField
                label="Webhook secret"
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
                      Regenerate
                    </Button>
                  ) : undefined
                }
              />
              <p className="text-xs text-muted-foreground">
                In your GitHub repository, open <b>Settings → Webhooks → Add webhook</b>. Paste the
                payload URL and secret, set the content type to{' '}
                <code className="rounded bg-muted px-1 py-0.5">application/json</code>, and choose
                only the <b>Pull requests</b> event.
              </p>
            </TabsContent>
          </Tabs>
        )}
        <SettingsRow
          title="Last delivery"
          description={
            settings.lastEventAt
              ? `Received ${formatDistanceToNow(parseISO(settings.lastEventAt), { addSuffix: true })}` +
                (settings.lastEventRepo ? ` from ${settings.lastEventRepo}` : '')
              : 'Nothing received yet.'
          }
          control={<span />}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
