import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { PlaneConnectionInput, PlaneProjectOption } from '@/lib/api/endpoints/importExport';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportConnectForm from './SettingsImportExportConnectForm';
import SettingsImportExportProjectPicker from './SettingsImportExportProjectPicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';

export interface PlaneConnection extends PlaneConnectionInput {
  projects: PlaneProjectOption[];
}

// The Plane source on the Import tab: connect to an instance, pick one of its projects,
// review the state mapping, start the job.
export default function SettingsImportExportPlane({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const [connection, setConnection] = useState<PlaneConnection | null>(null);
  const [selected, setSelected] = useState<PlaneProjectOption | null>(null);

  function onTested(next: PlaneConnection) {
    setConnection(next);
    setSelected(null);
  }

  return (
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
                target={{ source: 'plane', connection, project: selected }}
                onImported={() => setSelected(null)}
              />
            )}
          </SettingsCard>
        </SettingsSection>
      )}
    </>
  );
}
