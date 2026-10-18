import { useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { MsProjectUpload } from '@/lib/api/endpoints/importExport';
import { useUploadMsProjectFile } from '../../services/settings.service';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';

// The MS Project source on the Import tab: upload a plan saved as XML, review how its
// tasks map to states, start the job. Binary .mpp files are refused before upload.
export default function SettingsImportExportMsProject({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.importExport');
  const upload = useUploadMsProjectFile(projectKey);
  const [uploaded, setUploaded] = useState<MsProjectUpload | null>(null);
  const [mppRejected, setMppRejected] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setUploaded(null);
    setMppRejected(false);
    if (!file) return;
    if (/\.mpp$/i.test(file.name)) {
      setMppRejected(true);
      return;
    }
    try {
      setUploaded(await upload.mutateAsync(file));
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  return (
    <SettingsSection title={t('msproject.upload')} description={t('msproject.uploadHint')}>
      <SettingsCard className="space-y-6 p-4">
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="msproject-file">{t('msproject.file')}</Label>
          <Input
            id="msproject-file"
            type="file"
            accept=".xml,application/xml,text/xml"
            disabled={upload.isPending}
            onChange={(event) => void onFile(event)}
          />
          <p className="text-xs text-muted-foreground">{t('msproject.fileHint')}</p>
          {upload.isPending && (
            <p className="text-xs text-muted-foreground">{t('msproject.uploading')}</p>
          )}
          {mppRejected && (
            <p role="alert" className="text-xs text-destructive">
              {t('msproject.mppRejected')}
            </p>
          )}
        </div>
        {uploaded && (
          <>
            <p className="text-sm">
              {t('msproject.summary', { name: uploaded.fileName, count: uploaded.taskCount })}
            </p>
            <SettingsImportExportMappingReview
              key={uploaded.fileKey}
              projectKey={projectKey}
              target={{
                source: 'msproject',
                fileKey: uploaded.fileKey,
                fileName: uploaded.fileName,
                states: uploaded.states,
              }}
              onImported={() => setUploaded(null)}
            />
          </>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}
