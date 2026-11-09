import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useTestTrelloConnection } from '../../services/settings.service';
import { useTrelloAuthorize } from '../../hooks/useTrelloAuthorize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TrelloConnection } from './SettingsImportExportTrello';

// A Trello API key, then Trello's own authorization for it: the token comes back
// from Trello's window and is checked live. Nothing is stored until an import is
// actually started.
export default function SettingsImportExportTrelloConnectForm({
  projectKey,
  onTested,
}: {
  projectKey: string;
  onTested: (connection: TrelloConnection) => void;
}) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestTrelloConnection(projectKey);
  const authorize = useTrelloAuthorize();
  const [apiKey, setApiKey] = useState('');
  const [authorizing, setAuthorizing] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = apiKey.trim();
    setAuthorizing(true);
    let apiToken: string | null;
    try {
      apiToken = await authorize(key);
    } catch {
      toast.error(t('trello.popupBlocked'));
      return;
    } finally {
      setAuthorizing(false);
    }
    if (!apiToken) return;
    try {
      const result = await testConnection.mutateAsync({ apiKey: key, apiToken });
      onTested({ apiKey: key, apiToken, boards: result.boards });
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  const busy = authorizing || testConnection.isPending;
  let submitLabel = t('trello.authorize');
  if (authorizing) submitLabel = t('trello.authorizing');
  else if (testConnection.isPending) submitLabel = t('testing');

  return (
    <form
      onSubmit={(event) => void submit(event)}
      autoComplete="off"
      className="max-w-md space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="trello-api-key">{t('trello.apiKey')}</Label>
        <Input
          id="trello-api-key"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t.rich('trello.apiKeyHint', {
            origin: typeof window === 'undefined' ? '' : window.location.origin,
            link: (chunks) => (
              <a
                href="https://trello.com/power-ups/admin"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {chunks}
              </a>
            ),
            code: (chunks) => <code className="font-mono">{chunks}</code>,
          })}
        </p>
      </div>
      <Button type="submit" disabled={busy || apiKey.trim() === ''}>
        {submitLabel}
      </Button>
    </form>
  );
}
