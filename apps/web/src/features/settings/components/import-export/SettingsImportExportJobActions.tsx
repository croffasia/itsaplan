import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { ImportJob } from '@/lib/api/endpoints/importExport';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  usePauseImportJob,
  useResumeImportJob,
  useCancelImportJob,
} from '../../services/settings.service';

// Pause/resume/cancel are shown only when the status lets them succeed, matching what
// the API accepts (409 otherwise).
export default function SettingsImportExportJobActions({
  job,
  projectKey,
  editable,
  foldable,
  open,
  onToggle,
}: {
  job: ImportJob;
  projectKey: string;
  editable: boolean;
  foldable: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('settings.importExport');
  const pause = usePauseImportJob(projectKey);
  const resume = useResumeImportJob(projectKey);
  const cancel = useCancelImportJob(projectKey);

  const canPause = editable && (job.status === 'pending' || job.status === 'running');
  const canResume = editable && job.status === 'paused';
  const canCancel =
    editable && (job.status === 'pending' || job.status === 'running' || job.status === 'paused');

  return (
    <>
      {canPause && (
        <Button
          variant="outline"
          size="sm"
          disabled={pause.isPending}
          onClick={() => pause.mutate(job.id)}
        >
          {t('pause')}
        </Button>
      )}
      {canResume && (
        <Button
          variant="outline"
          size="sm"
          disabled={resume.isPending}
          onClick={() => resume.mutate(job.id)}
        >
          {t('resume')}
        </Button>
      )}
      {canCancel && (
        <Button
          variant="ghost"
          size="sm"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(job.id)}
        >
          {t('cancel')}
        </Button>
      )}
      {foldable && (
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={onToggle}>
          {open ? t('hideDetails') : t('showDetails')}
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
        </Button>
      )}
    </>
  );
}
