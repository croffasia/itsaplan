import { useTranslations } from 'next-intl';
import { useImportJobsQuery } from '../../services/settings.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import SettingsCard from '@/components/common/page/SettingsCard';
import type { ImportSourceEntry } from '../../types/importSource';
import SettingsImportExportJobRow, { type JobSource } from './SettingsImportExportJobRow';

// A job of a source the build no longer offers (one a license added, say) keeps its
// card, named by its key and without a mark.
function sourceOf(sources: ImportSourceEntry[], key: string): JobSource {
  const entry = sources.find((e) => e.kind === 'source' && e.key === key);
  if (entry?.kind === 'source') return { label: entry.label, Logo: entry.Logo };
  return { label: key.charAt(0).toUpperCase() + key.slice(1), Logo: null };
}

export default function SettingsImportExportJobList({
  projectKey,
  editable,
  sources,
}: {
  projectKey: string;
  editable: boolean;
  sources: ImportSourceEntry[];
}) {
  const t = useTranslations('settings.importExport');
  const jobsQuery = useImportJobsQuery(projectKey);

  if (jobsQuery.isPending) return <ListSkeleton rows={2} rowClassName="h-24" />;

  const jobs = jobsQuery.data ?? [];
  if (jobs.length === 0) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />;
  }

  return (
    <SettingsCard className="divide-y divide-border/60">
      {jobs.map((job) => (
        <SettingsImportExportJobRow
          key={job.id}
          job={job}
          source={sourceOf(sources, job.source)}
          projectKey={projectKey}
          editable={editable}
        />
      ))}
    </SettingsCard>
  );
}
