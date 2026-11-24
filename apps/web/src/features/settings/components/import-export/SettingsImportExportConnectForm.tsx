import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useTestPlaneConnection } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlaneConnection } from './SettingsImportExportPlane';

// baseUrl/workspaceSlug/apiToken for a source Plane instance, checked live
// against it. Nothing is stored until an import is actually started. Opened again, it
// starts from what it connected with.
export default function SettingsImportExportConnectForm({
  projectKey,
  initial,
  onTested,
}: {
  projectKey: string;
  initial: PlaneConnection | null;
  onTested: (connection: PlaneConnection) => void;
}) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestPlaneConnection(projectKey);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [workspaceSlug, setWorkspaceSlug] = useState(initial?.workspaceSlug ?? '');
  const [apiToken, setApiToken] = useState(initial?.apiToken ?? '');

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
    <form onSubmit={(event) => void submit(event)} autoComplete="off" className="space-y-6">
      <div className="grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
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
            aria-describedby="plane-workspace-hint"
            required
          />
          <p id="plane-workspace-hint" className="text-xs text-muted-foreground">
            {t('workspaceSlugHint')}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plane-token">{t('apiToken')}</Label>
          <Input
            id="plane-token"
            type="password"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            aria-describedby="plane-token-hint"
            required
          />
          <p id="plane-token-hint" className="text-xs text-muted-foreground">
            {t('apiTokenHint')}
          </p>
        </div>
      </div>
      <Button type="submit" disabled={testConnection.isPending || !valid}>
        {testConnection.isPending ? t('testing') : t('testConnection')}
      </Button>
    </form>
  );
}
