import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type {
  ProcoreConnectionInput,
  ProcoreProjectOption,
  ProcoreTool,
} from '@/lib/api/endpoints/importExport';
import { useTestProcoreConnection } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

const EMPTY: ProcoreConnectionInput = {
  clientId: '',
  clientSecret: '',
  companyId: '',
  sandbox: false,
};

// The Procore source on the Import tab: check a service account, pick a project and
// a tool, review how the tool's statuses map to states, start the job.
export default function SettingsImportExportProcore({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.importExport');
  const testConnection = useTestProcoreConnection(projectKey);
  const [form, setForm] = useState<ProcoreConnectionInput>(EMPTY);
  const [connection, setConnection] = useState<{
    input: ProcoreConnectionInput;
    projects: ProcoreProjectOption[];
  } | null>(null);
  const [selected, setSelected] = useState<ProcoreProjectOption | null>(null);
  const [tool, setTool] = useState<ProcoreTool | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret.trim(),
      companyId: form.companyId.trim(),
      sandbox: form.sandbox,
    };
    try {
      const result = await testConnection.mutateAsync(input);
      setConnection({ input, projects: result.projects });
      setSelected(null);
      setTool(null);
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  const complete = form.clientId.trim() && form.clientSecret.trim() && form.companyId.trim();

  return (
    <>
      <SettingsSection title={t('procore.connect')} description={t('procore.connectHint')}>
        <SettingsCard className="p-4">
          <form
            onSubmit={(event) => void submit(event)}
            autoComplete="off"
            className="max-w-md space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="procore-client-id">{t('procore.clientId')}</Label>
              <Input
                id="procore-client-id"
                autoComplete="off"
                required
                value={form.clientId}
                onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="procore-client-secret">{t('procore.clientSecret')}</Label>
              <Input
                id="procore-client-secret"
                type="password"
                autoComplete="off"
                required
                value={form.clientSecret}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, clientSecret: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">{t('procore.clientSecretHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="procore-company-id">{t('procore.companyId')}</Label>
              <Input
                id="procore-company-id"
                inputMode="numeric"
                autoComplete="off"
                required
                value={form.companyId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, companyId: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">{t('procore.companyIdHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="procore-sandbox"
                checked={form.sandbox}
                onCheckedChange={(sandbox) => setForm((prev) => ({ ...prev, sandbox }))}
              />
              <Label htmlFor="procore-sandbox">{t('procore.sandbox')}</Label>
            </div>
            <Button type="submit" disabled={testConnection.isPending || !complete}>
              {testConnection.isPending ? t('testing') : t('testConnection')}
            </Button>
          </form>
        </SettingsCard>
      </SettingsSection>
      {connection && (
        <SettingsSection title={t('procore.scope')} description={t('procore.scopeHint')}>
          <SettingsCard className="space-y-6 p-4">
            {connection.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('procore.noProjects')}</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                <div className="w-64 space-y-1.5">
                  <Label htmlFor="procore-project">{t('procore.project')}</Label>
                  <Select
                    value={selected?.id ?? ''}
                    onValueChange={(id) =>
                      setSelected(connection.projects.find((p) => p.id === id) ?? null)
                    }
                  >
                    <SelectTrigger id="procore-project" className="w-full">
                      <SelectValue placeholder={t('procore.projectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {connection.projects.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-64 space-y-1.5">
                  <Label htmlFor="procore-tool">{t('procore.tool')}</Label>
                  <Select
                    value={tool ?? ''}
                    onValueChange={(value) => setTool(value as ProcoreTool)}
                  >
                    <SelectTrigger id="procore-tool" className="w-full">
                      <SelectValue placeholder={t('procore.toolPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="punch_items">{t('procore.toolPunchItems')}</SelectItem>
                      <SelectItem value="rfis">{t('procore.toolRfis')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {selected && tool && (
              <SettingsImportExportMappingReview
                key={`${selected.id}:${tool}`}
                projectKey={projectKey}
                target={{
                  source: 'procore',
                  connection: connection.input,
                  procoreProjectId: selected.id,
                  procoreTool: tool,
                }}
                onImported={() => {
                  setSelected(null);
                  setTool(null);
                }}
              />
            )}
          </SettingsCard>
        </SettingsSection>
      )}
    </>
  );
}
