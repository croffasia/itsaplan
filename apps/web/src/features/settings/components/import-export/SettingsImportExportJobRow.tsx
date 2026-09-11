import { useTranslations } from 'next-intl';
import type { ImportJob } from '@/lib/api/endpoints/importJobs';
import { formatDateTime } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  usePauseImportJob,
  useResumeImportJob,
  useCancelImportJob,
} from '../../services/settings.service';
import SettingsWarningBanner from '../SettingsWarningBanner';
import SettingsImportExportJobCounts from './SettingsImportExportJobCounts';

const STATUS_VARIANT: Record<
  ImportJob['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  running: 'default',
  paused: 'secondary',
  completed: 'secondary',
  failed: 'destructive',
};

// One import job: its status, phase, per-entity progress, and the actions its
// current status allows. Pause/resume/cancel are shown only when the status lets
// them succeed, matching what the API accepts (409 otherwise).
export default function SettingsImportExportJobRow({
  job,
  projectKey,
  editable,
}: {
  job: ImportJob;
  projectKey: string;
  editable: boolean;
}) {
  const t = useTranslations('settings.importExport');
  const pause = usePauseImportJob(projectKey);
  const resume = useResumeImportJob(projectKey);
  const cancel = useCancelImportJob(projectKey);

  const canPause = editable && (job.status === 'pending' || job.status === 'running');
  const canResume = editable && job.status === 'paused';
  const canCancel =
    editable && (job.status === 'pending' || job.status === 'running' || job.status === 'paused');

  // lastError is cleared on every successful tick, so seeing one while still
  // 'pending' means the job is currently waiting out a retry, not stalled —
  // 'failed' is the only terminal, non-retrying error state.
  const isRetrying = job.status === 'pending' && job.lastError != null;
  const isWorking = job.status === 'pending' && job.lastError == null;
  const retrySeconds = isRetrying
    ? Math.max(0, Math.round((new Date(job.nextAttemptAt).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[job.status]}>{t(`statuses.${job.status}`)}</Badge>
          {(isWorking || isRetrying) && (
            <>
              {isWorking && (
                <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              )}
              <span className="text-sm font-medium">{t(`phases.${job.phase}`)}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>
      {isRetrying && job.lastError && (
        <SettingsWarningBanner>
          {job.lastError === 'rate limited'
            ? t('rateLimitedRetrying', { seconds: retrySeconds })
            : t('transientErrorRetrying', { error: job.lastError, seconds: retrySeconds })}
        </SettingsWarningBanner>
      )}
      {job.status === 'failed' && job.lastError && (
        <p className="text-xs text-destructive">{job.lastError}</p>
      )}
      <SettingsImportExportJobCounts counts={job.counts} />
    </div>
  );
}
