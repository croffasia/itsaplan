import { useTranslations } from 'next-intl';
import { useImportJobsQuery } from '../../services/settings.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsImportExportJobRow from './SettingsImportExportJobRow';

export default function SettingsImportExportJobList({
  projectKey,
  editable,
}: {
  projectKey: string;
  editable: boolean;
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
          projectKey={projectKey}
          editable={editable}
        />
      ))}
    </SettingsCard>
  );
}
