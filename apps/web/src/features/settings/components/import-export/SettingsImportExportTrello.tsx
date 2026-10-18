import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { TrelloBoardOption, TrelloConnectionInput } from '@/lib/api/endpoints/importExport';
import { useTestTrelloConnection } from '../../services/settings.service';
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

// The Trello source on the Import tab: check an API key and token, pick a board,
// review how its lists map to states, start the job.
export default function SettingsImportExportTrello({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestTrelloConnection(projectKey);
  const [form, setForm] = useState<TrelloConnectionInput>({ apiKey: '', token: '' });
  const [connection, setConnection] = useState<{
    input: TrelloConnectionInput;
    boards: TrelloBoardOption[];
  } | null>(null);
  const [selected, setSelected] = useState<TrelloBoardOption | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { apiKey: form.apiKey.trim(), token: form.token.trim() };
    try {
      const result = await testConnection.mutateAsync(input);
      setConnection({ input, boards: result.boards });
      setSelected(null);
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  return (
    <>
      <SettingsSection title={t('trello.connect')} description={t('trello.connectHint')}>
        <SettingsCard className="p-4">
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
                required
                value={form.apiKey}
                onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trello-token">{t('trello.token')}</Label>
              <Input
                id="trello-token"
                type="password"
                autoComplete="off"
                required
                value={form.token}
                onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t('trello.tokenHint')}</p>
            </div>
            <Button
              type="submit"
              disabled={testConnection.isPending || !form.apiKey.trim() || !form.token.trim()}
            >
              {testConnection.isPending ? t('testing') : t('testConnection')}
            </Button>
          </form>
        </SettingsCard>
      </SettingsSection>
      {connection && (
        <SettingsSection title={t('trello.board')} description={t('trello.boardHint')}>
          <SettingsCard className="space-y-6 p-4">
            {connection.boards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('trello.noBoards')}</p>
            ) : (
              <div className="w-64 space-y-1.5">
                <Label htmlFor="trello-board">{t('trello.board')}</Label>
                <Select
                  value={selected?.id ?? ''}
                  onValueChange={(id) =>
                    setSelected(connection.boards.find((b) => b.id === id) ?? null)
                  }
                >
                  <SelectTrigger id="trello-board" className="w-full">
                    <SelectValue placeholder={t('trello.boardPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {connection.boards.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.closed
                          ? t('trello.closedBoard', { name: option.name })
                          : option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selected && (
              <SettingsImportExportMappingReview
                key={selected.id}
                projectKey={projectKey}
                target={{
                  source: 'trello',
                  connection: connection.input,
                  trelloBoardId: selected.id,
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
