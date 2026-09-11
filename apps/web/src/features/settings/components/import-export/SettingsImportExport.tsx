import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { PlaneConnectionInput, PlaneProjectOption } from '@/lib/api/endpoints/importJobs';
import { usePermissions } from '@/hooks/usePermissions';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportConnectForm from './SettingsImportExportConnectForm';
import SettingsImportExportProjectPicker from './SettingsImportExportProjectPicker';
import SettingsImportExportJobList from './SettingsImportExportJobList';

export interface PlaneConnection extends PlaneConnectionInput {
  projects: PlaneProjectOption[];
}

// The Plane import flow: connect to a source instance, pick a project to import
// from, and watch the jobs already started. A member who cannot start an import
// (import_jobs: create) still sees the job list, since reading it needs only
// import_jobs: read, which the page itself already requires.
export default function SettingsImportExport({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.key;
  const { can } = usePermissions();
  const canCreate = can('import_jobs', 'create');
  const canEdit = can('import_jobs', 'edit');
  const [connection, setConnection] = useState<PlaneConnection | null>(null);

  return (
    <div className="space-y-10">
      {canCreate && (
        <>
          <SettingsSection title={t('connect')} description={t('connectHint')}>
            <SettingsCard className="p-4">
              <SettingsImportExportConnectForm projectKey={projectKey} onTested={setConnection} />
            </SettingsCard>
          </SettingsSection>
          {connection && (
            <SettingsSection title={t('sourceProject')} description={t('sourceProjectHint')}>
              <SettingsCard className="p-4">
                <SettingsImportExportProjectPicker
                  key={connection.baseUrl + connection.workspaceSlug}
                  projectKey={projectKey}
                  connection={connection}
                />
              </SettingsCard>
            </SettingsSection>
          )}
        </>
      )}
      <SettingsSection title={t('jobs')} description={t('jobsHint')}>
        <SettingsImportExportJobList projectKey={projectKey} editable={canEdit} />
      </SettingsSection>
    </div>
  );
}
