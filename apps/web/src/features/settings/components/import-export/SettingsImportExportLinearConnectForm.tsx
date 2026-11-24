import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useTestLinearConnection } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LinearConnection } from './SettingsImportExportLinear';

// A Linear personal API key, checked live against Linear. Nothing is stored until
// an import is actually started. Opened again, it starts from the key it connected with.
export default function SettingsImportExportLinearConnectForm({
  projectKey,
  initial,
  onTested,
}: {
  projectKey: string;
  initial: LinearConnection | null;
  onTested: (connection: LinearConnection) => void;
}) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestLinearConnection(projectKey);
  const [apiToken, setApiToken] = useState(initial?.apiToken ?? '');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { apiToken: apiToken.trim() };
    try {
      const result = await testConnection.mutateAsync(input);
      onTested({ ...input, teams: result.teams });
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} autoComplete="off" className="space-y-6">
      <div className="grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="linear-api-key">{t('linear.apiKey')}</Label>
          <Input
            id="linear-api-key"
            type="password"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            aria-describedby="linear-api-key-hint"
            required
          />
          <p id="linear-api-key-hint" className="text-xs text-muted-foreground">
            {t('linear.apiKeyHint')}
          </p>
        </div>
      </div>
      <Button type="submit" disabled={testConnection.isPending || apiToken.trim() === ''}>
        {testConnection.isPending ? t('testing') : t('testConnection')}
      </Button>
    </form>
  );
}
