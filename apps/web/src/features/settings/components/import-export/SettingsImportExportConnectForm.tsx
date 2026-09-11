import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useTestPlaneConnection } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlaneConnection } from './SettingsImportExport';

// baseUrl/workspaceSlug/apiToken for a source Plane instance, checked live
// against it. Nothing is stored until an import is actually started.
export default function SettingsImportExportConnectForm({
  projectKey,
  onTested,
}: {
  projectKey: string;
  onTested: (connection: PlaneConnection) => void;
}) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestPlaneConnection(projectKey);
  const [baseUrl, setBaseUrl] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [apiToken, setApiToken] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      baseUrl: baseUrl.trim(),
      workspaceSlug: workspaceSlug.trim(),
      apiToken: apiToken.trim(),
    };
    try {
      const result = await testConnection.mutateAsync(input);
      onTested({ ...input, projects: result.projects });
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  const valid = baseUrl.trim() !== '' && workspaceSlug.trim() !== '' && apiToken.trim() !== '';

  return (
    <form onSubmit={(event) => void submit(event)} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="plane-base-url">{t('baseUrl')}</Label>
        <Input
          id="plane-base-url"
          type="url"
          placeholder="https://plane.example.com"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plane-workspace">{t('workspaceSlug')}</Label>
        <Input
          id="plane-workspace"
          value={workspaceSlug}
          onChange={(event) => setWorkspaceSlug(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plane-token">{t('apiToken')}</Label>
        <Input
          id="plane-token"
          type="password"
          autoComplete="off"
          value={apiToken}
          onChange={(event) => setApiToken(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">{t('apiTokenHint')}</p>
      </div>
      <Button type="submit" disabled={testConnection.isPending || !valid}>
        {testConnection.isPending ? t('testing') : t('testConnection')}
      </Button>
    </form>
  );
}
