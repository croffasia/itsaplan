'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportProject } from '@/lib/api/endpoints/importJobs';

// Downloads a self-contained JSON snapshot of the project's data. A plain read, not a
// mutation, so it builds and triggers the file save itself rather than going through
// React Query - same blob + createObjectURL + synthetic-anchor pattern as
// DocumentExportDialog's document export.
export default function SettingsImportExportDownloadButton({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.importExport');
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const data = await exportProject(projectKey);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${projectKey}-export.json`;
      anchor.hidden = true;
      try {
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" disabled={pending} onClick={() => void download()}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {t('exportProjectData')}
    </Button>
  );
}
