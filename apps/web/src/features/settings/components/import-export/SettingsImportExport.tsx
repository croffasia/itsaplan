import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { PlaneConnectionInput, PlaneProjectOption } from '@/lib/api/endpoints/importExport';
import { usePermissions } from '@/hooks/usePermissions';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportConnectForm from './SettingsImportExportConnectForm';
import SettingsImportExportProjectPicker from './SettingsImportExportProjectPicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';
import SettingsImportExportJobList from './SettingsImportExportJobList';
import SettingsImportExportDownloadButton from './SettingsImportExportDownloadButton';

export interface PlaneConnection extends PlaneConnectionInput {
  projects: PlaneProjectOption[];
}

// The Plane import flow: connect to a source instance, pick a project to import
// from, and watch the jobs already started. A member who cannot start an import
// (import_export: create) still sees the job list, since reading it needs only
// import_export: read, which the page itself already requires.
export default function SettingsImportExport({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.key;
  const { can } = usePermissions();
  const canCreate = can('import_export', 'create');
  const canEdit = can('import_export', 'edit');
  const [connection, setConnection] = useState<PlaneConnection | null>(null);
  const [selected, setSelected] = useState<PlaneProjectOption | null>(null);

  function onTested(next: PlaneConnection) {
    setConnection(next);
    setSelected(null);
  }

  return (
    <div className="space-y-10">
      {canCreate && (
        <>
          <SettingsSection title={t('connect')} description={t('connectHint')}>
            <SettingsCard className="p-4">
              <SettingsImportExportConnectForm projectKey={projectKey} onTested={onTested} />
            </SettingsCard>
          </SettingsSection>
          {connection && (
            <SettingsSection title={t('sourceProject')} description={t('sourceProjectHint')}>
              <SettingsCard className="space-y-6 p-4">
                <SettingsImportExportProjectPicker
                  key={connection.baseUrl + connection.workspaceSlug}
                  connection={connection}
                  selected={selected}
                  onSelect={setSelected}
                />
                {selected && (
                  <SettingsImportExportMappingReview
                    projectKey={projectKey}
                    connection={connection}
                    selected={selected}
                    onImported={() => setSelected(null)}
                  />
                )}
              </SettingsCard>
            </SettingsSection>
          )}
        </>
      )}
      <SettingsSection title={t('jobs')} description={t('jobsHint')}>
        <SettingsImportExportJobList projectKey={projectKey} editable={canEdit} />
      </SettingsSection>
      {canCreate && (
        <SettingsSection title={t('export')} description={t('exportHint')}>
          <SettingsImportExportDownloadButton projectKey={projectKey} />
        </SettingsSection>
      )}
    </div>
  );
}
