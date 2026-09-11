import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useCreateImportJob } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlaneConnection } from './SettingsImportExport';

// The projects of the tested workspace, and the button that starts the import.
export default function SettingsImportExportProjectPicker({
  projectKey,
  connection,
}: {
  projectKey: string;
  connection: PlaneConnection;
}) {
  const t = useTranslations('settings.importExport');
  const createJob = useCreateImportJob(projectKey);
  const [planeProjectId, setPlaneProjectId] = useState('');

  async function start() {
    const { baseUrl, workspaceSlug, apiToken } = connection;
    try {
      await createJob.mutateAsync({ baseUrl, workspaceSlug, apiToken, planeProjectId });
      toast.success(t('importStarted'));
      setPlaneProjectId('');
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  if (connection.projects.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noProjects')}</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-64 space-y-1.5">
        <Label htmlFor="plane-source-project">{t('sourceProjectLabel')}</Label>
        <Select value={planeProjectId} onValueChange={setPlaneProjectId}>
          <SelectTrigger id="plane-source-project" className="w-full">
            <SelectValue placeholder={t('sourceProjectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {connection.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.identifier})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button disabled={!planeProjectId || createJob.isPending} onClick={() => void start()}>
        {createJob.isPending ? t('starting') : t('startImport')}
      </Button>
    </div>
  );
}
