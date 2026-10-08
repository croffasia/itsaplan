import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LinearTeamOption } from '@/lib/api/endpoints/importExport';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportLinearConnectForm from './SettingsImportExportLinearConnectForm';
import SettingsImportExportLinearScopePicker, {
  NO_PROJECT,
} from './SettingsImportExportLinearScopePicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';

export interface LinearConnection {
  apiToken: string;
  teams: LinearTeamOption[];
}

// The Linear source on the Import tab: check an API key, pick a team and one of its
// projects (or its issues with no project), review the state mapping, start the job.
export default function SettingsImportExportLinear({ projectKey }: { projectKey: string }) {
  const t = useTranslations('settings.importExport');
  const [connection, setConnection] = useState<LinearConnection | null>(null);
  const [team, setTeam] = useState<LinearTeamOption | null>(null);
  const [projectChoice, setProjectChoice] = useState<string | null>(null);

  function onTested(next: LinearConnection) {
    setConnection(next);
    setTeam(null);
    setProjectChoice(null);
  }

  function onTeamChange(next: LinearTeamOption | null) {
    setTeam(next);
    setProjectChoice(null);
  }

  return (
    <>
      <SettingsSection title={t('linear.connect')} description={t('linear.connectHint')}>
        <SettingsCard className="p-4">
          <SettingsImportExportLinearConnectForm projectKey={projectKey} onTested={onTested} />
        </SettingsCard>
      </SettingsSection>
      {connection && (
        <SettingsSection title={t('linear.scope')} description={t('linear.scopeHint')}>
          <SettingsCard className="space-y-6 p-4">
            <SettingsImportExportLinearScopePicker
              teams={connection.teams}
              team={team}
              projectChoice={projectChoice}
              onTeamChange={onTeamChange}
              onProjectChoiceChange={setProjectChoice}
            />
            {team && projectChoice && (
              <SettingsImportExportMappingReview
                key={`${team.id}:${projectChoice}`}
                projectKey={projectKey}
                target={{
                  source: 'linear',
                  apiToken: connection.apiToken,
                  team,
                  projectId: projectChoice === NO_PROJECT ? null : projectChoice,
                }}
                onImported={() => setProjectChoice(null)}
              />
            )}
          </SettingsCard>
        </SettingsSection>
      )}
    </>
  );
}
