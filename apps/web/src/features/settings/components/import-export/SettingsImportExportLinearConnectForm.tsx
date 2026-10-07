import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useTestLinearConnection } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LinearConnection } from './SettingsImportExportLinear';

// A Linear personal API key, checked live against Linear. Nothing is stored until
// an import is actually started.
export default function SettingsImportExportLinearConnectForm({
  projectKey,
  onTested,
}: {
  projectKey: string;
  onTested: (connection: LinearConnection) => void;
}) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestLinearConnection(projectKey);
  const [apiToken, setApiToken] = useState('');

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
    <form
      onSubmit={(event) => void submit(event)}
      autoComplete="off"
      className="max-w-md space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="linear-api-key">{t('linear.apiKey')}</Label>
        <Input
          id="linear-api-key"
          type="password"
          autoComplete="off"
          value={apiToken}
          onChange={(event) => setApiToken(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">{t('linear.apiKeyHint')}</p>
      </div>
      <Button type="submit" disabled={testConnection.isPending || apiToken.trim() === ''}>
        {testConnection.isPending ? t('testing') : t('testConnection')}
      </Button>
    </form>
  );
}
