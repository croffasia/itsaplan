import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { PlaneConnectionInput, PlaneProjectOption } from '@/lib/api/endpoints/importExport';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { useImportSteps } from '../../hooks/useImportSteps';
import SettingsImportExportConnectForm from './SettingsImportExportConnectForm';
import SettingsImportExportProjectPicker from './SettingsImportExportProjectPicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';
import SettingsImportExportStep from './SettingsImportExportStep';

export interface PlaneConnection extends PlaneConnectionInput {
  projects: PlaneProjectOption[];
}

const STEPS = ['connect', 'project', 'review'] as const;

// The Plane source on the Import tab, one step at a time: connect to an instance, pick one
// of its projects, review the state mapping and start the job.
export default function SettingsImportExportPlane({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const [connection, setConnection] = useState<PlaneConnection | null>(null);
  const [selected, setSelected] = useState<PlaneProjectOption | null>(null);
  const { open, step } = useImportSteps(STEPS);

  function onTested(next: PlaneConnection) {
    setConnection(next);
    setSelected(null);
    open('project');
  }

  // A picked project is cleared on the way back: a select does not report picking it again.
  function pickAgain() {
    setSelected(null);
    open('project');
  }

  const host = connection?.baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  return (
    <SettingsSection title={t('title', { source: 'Plane' })} description={t('connectHint')}>
      <SettingsCard className="p-6">
        <ol>
          <SettingsImportExportStep
            {...step('connect')}
            title={t('stepConnect', { source: 'Plane' })}
            summary={connection ? `${host}/${connection.workspaceSlug}` : undefined}
          >
            <SettingsImportExportConnectForm
              projectKey={projectKey}
              initial={connection}
              onTested={onTested}
            />
          </SettingsImportExportStep>

          <SettingsImportExportStep
            {...step('project')}
            onChange={pickAgain}
            title={t('stepProject')}
            summary={selected ? `${selected.name} (${selected.identifier})` : undefined}
          >
            {connection && (
              <SettingsImportExportProjectPicker
                connection={connection}
                selected={selected}
                onSelect={(next) => {
                  setSelected(next);
                  open('review');
                }}
              />
            )}
          </SettingsImportExportStep>

          <SettingsImportExportStep {...step('review')} title={t('stepReview')}>
            {connection && selected && (
              <SettingsImportExportMappingReview
                key={selected.id}
                projectKey={projectKey}
                target={{ source: 'plane', connection, project: selected }}
                onImported={pickAgain}
              />
            )}
          </SettingsImportExportStep>
        </ol>
      </SettingsCard>
    </SettingsSection>
  );
}
