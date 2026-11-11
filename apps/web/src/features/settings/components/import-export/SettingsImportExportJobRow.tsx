import { useState, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { Download, ExternalLink } from 'lucide-react';
import type { ImportEntityType, ImportJob } from '@/lib/api/endpoints/importExport';
import { formatDateTime } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import SettingsImportExportJobCounts from './SettingsImportExportJobCounts';
import SettingsImportExportJobActions from './SettingsImportExportJobActions';
import SettingsImportExportJobRetryBanner from './SettingsImportExportJobRetryBanner';

export interface JobSource {
  label: string;
  Logo: ComponentType<{ className?: string }> | null;
}

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

// What a folded card sums up in a line.
const SUMMARY_ENTITIES: ImportEntityType[] = ['issue', 'comment', 'attachment'];

export default function SettingsImportExportJobRow({
  job,
  source,
  projectKey,
  editable,
}: {
  job: ImportJob;
  source: JobSource;
  projectKey: string;
  editable: boolean;
}) {
  const t = useTranslations('settings.importExport');
  const [open, setOpen] = useState(false);
  const foldable = job.status === 'completed' || job.status === 'failed';
  const expanded = !foldable || open;

  // lastError is cleared on every successful tick, so seeing one while still
  // 'pending' means the job is currently waiting out a retry, not stalled —
  // 'failed' is the only terminal, non-retrying error state.
  const retryError = job.status === 'pending' ? job.lastError : null;
  const isWorking = job.status === 'pending' && job.lastError == null;
  const failure = job.status === 'failed' ? job.lastError : null;

  const { Logo } = source;
  const project = job.sourceProject;
  const date = formatDateTime(job.createdAt);
  const summary = SUMMARY_ENTITIES.filter((type) => job.counts[type].discovered > 0)
    .map((type) => {
      const { created, discovered } = job.counts[type];
      return `${t(`entities.${type}`)} ${created === discovered ? created : `${created}/${discovered}`}`;
    })
    .join(' · ');

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background">
          {Logo ? (
            <Logo className="size-5" />
          ) : (
            <Download className="size-4 text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          {project?.url ? (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              title={t('openInSource', { source: source.label })}
              className="inline-flex max-w-full items-center gap-1 text-[15px] font-medium hover:underline"
            >
              <span className="truncate">{project.name}</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </a>
          ) : (
            <p className="truncate text-[15px] font-medium">{project?.name ?? source.label}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {project ? `${source.label} · ${date}` : date}
          </p>
          {!expanded && summary && <p className="pt-1 text-sm">{summary}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {(isWorking || retryError) && (
            <>
              {isWorking && (
                <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              )}
              <span className="text-sm font-medium">{t(`phases.${job.phase}`)}</span>
            </>
          )}
          <Badge variant={STATUS_VARIANT[job.status]}>{t(`statuses.${job.status}`)}</Badge>
          <SettingsImportExportJobActions
            job={job}
            projectKey={projectKey}
            editable={editable}
            foldable={foldable}
            open={open}
            onToggle={() => setOpen((value) => !value)}
          />
        </div>
      </div>
      {(retryError || failure || expanded) && (
        <div className="space-y-3 sm:ps-12">
          {retryError && (
            <SettingsImportExportJobRetryBanner
              error={retryError}
              nextAttemptAt={job.nextAttemptAt}
            />
          )}
          {failure && <p className="text-xs text-destructive">{failure}</p>}
          {expanded && <SettingsImportExportJobCounts counts={job.counts} />}
        </div>
      )}
    </div>
  );
}
