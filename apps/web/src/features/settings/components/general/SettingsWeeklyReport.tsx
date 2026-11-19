'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useWeeklyReportSettings } from '@/services/weeklyReports.service';
import SettingsWeeklyReportForm from './SettingsWeeklyReportForm';

export default function SettingsWeeklyReport({ project }: { project: ProjectDetail }) {
  const t = useTranslations('documents.weeklyReport');
  const { can } = usePermissions(project);
  const query = useWeeklyReportSettings(project.project.ref);

  return (
    <section className="space-y-4" aria-labelledby="weekly-report-settings">
      <div>
        <h2 id="weekly-report-settings" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settingsHelp')}</p>
      </div>
      {query.isPending && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      )}
      {query.isSuccess && (
        <SettingsWeeklyReportForm
          project={project}
          current={query.data}
          editable={can('workflow_config', 'edit')}
        />
      )}
    </section>
  );
}
