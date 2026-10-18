import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { JiraConnectionInput, JiraProjectOption } from '@/lib/api/endpoints/importExport';
import { useTestJiraConnection } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';

// The Jira source on the Import tab: check a Jira Cloud site with an account email
// and API token, pick one of its projects, review the state mapping, start the job.
export default function SettingsImportExportJira({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestJiraConnection(projectKey);
  const [form, setForm] = useState<JiraConnectionInput>({ baseUrl: '', email: '', apiToken: '' });
  const [connection, setConnection] = useState<{
    input: JiraConnectionInput;
    projects: JiraProjectOption[];
  } | null>(null);
  const [selected, setSelected] = useState<JiraProjectOption | null>(null);
  const filled = form.baseUrl.trim() && form.email.trim() && form.apiToken.trim();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      baseUrl: form.baseUrl.trim(),
      email: form.email.trim(),
      apiToken: form.apiToken.trim(),
    };
    try {
      const result = await testConnection.mutateAsync(input);
      setConnection({ input, projects: result.projects });
      setSelected(null);
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  const field = (key: keyof JiraConnectionInput) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });

  return (
    <>
      <SettingsSection title={t('jira.connect')} description={t('jira.connectHint')}>
        <SettingsCard className="p-4">
          <form
            onSubmit={(event) => void submit(event)}
            autoComplete="off"
            className="max-w-md space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="jira-base-url">{t('jira.siteUrl')}</Label>
              <Input
                id="jira-base-url"
                type="url"
                placeholder="https://acme.atlassian.net"
                required
                {...field('baseUrl')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jira-email">{t('jira.email')}</Label>
              <Input id="jira-email" type="email" required {...field('email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jira-api-token">{t('apiToken')}</Label>
              <Input
                id="jira-api-token"
                type="password"
                autoComplete="off"
                required
                {...field('apiToken')}
              />
              <p className="text-xs text-muted-foreground">{t('jira.apiTokenHint')}</p>
            </div>
            <Button type="submit" disabled={testConnection.isPending || !filled}>
              {testConnection.isPending ? t('testing') : t('testConnection')}
            </Button>
          </form>
        </SettingsCard>
      </SettingsSection>
      {connection && (
        <SettingsSection title={t('sourceProject')} description={t('jira.projectHint')}>
          <SettingsCard className="space-y-6 p-4">
            {connection.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('jira.noProjects')}</p>
            ) : (
              <div className="w-64 space-y-1.5">
                <Label htmlFor="jira-project">{t('jira.project')}</Label>
                <Select
                  value={selected?.key ?? ''}
                  onValueChange={(key) =>
                    setSelected(connection.projects.find((p) => p.key === key) ?? null)
                  }
                >
                  <SelectTrigger id="jira-project" className="w-full">
                    <SelectValue placeholder={t('sourceProjectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {connection.projects.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.name} ({option.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selected && (
              <SettingsImportExportMappingReview
                key={selected.key}
                projectKey={projectKey}
                target={{
                  source: 'jira',
                  connection: connection.input,
                  jiraProjectKey: selected.key,
                }}
                onImported={() => setSelected(null)}
              />
            )}
          </SettingsCard>
        </SettingsSection>
      )}
    </>
  );
}
