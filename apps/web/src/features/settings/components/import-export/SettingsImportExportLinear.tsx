import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LinearTeamOption } from '@/lib/api/endpoints/importExport';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { useImportSteps } from '../../hooks/useImportSteps';
import SettingsImportExportLinearConnectForm from './SettingsImportExportLinearConnectForm';
import SettingsImportExportLinearScopePicker, {
  NO_PROJECT,
} from './SettingsImportExportLinearScopePicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';
import SettingsImportExportStep from './SettingsImportExportStep';

export interface LinearConnection {
  apiToken: string;
  teams: LinearTeamOption[];
}

const STEPS = ['connect', 'scope', 'review'] as const;

// The Linear source on the Import tab, one step at a time: check an API key, pick a team
// and one of its projects (or its issues with no project), review the state mapping and
// start the job.
export default function SettingsImportExportLinear({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const [connection, setConnection] = useState<LinearConnection | null>(null);
  const [team, setTeam] = useState<LinearTeamOption | null>(null);
  const [projectChoice, setProjectChoice] = useState<string | null>(null);
  const { open, step } = useImportSteps(STEPS);

  function onTested(next: LinearConnection) {
    setConnection(next);
    setTeam(null);
    setProjectChoice(null);
    open('scope');
  }

  function onTeamChange(next: LinearTeamOption | null) {
    setTeam(next);
    setProjectChoice(null);
  }

  // The project is cleared on the way back: a select does not report picking it again.
  function pickAgain() {
    setProjectChoice(null);
    open('scope');
  }

  const projectName =
    projectChoice === NO_PROJECT
      ? t('linear.noProject')
      : team?.projects.find((p) => p.id === projectChoice)?.name;

  return (
    <SettingsSection title={t('title', { source: 'Linear' })} description={t('linear.connectHint')}>
      <SettingsCard className="p-6">
        <ol>
          <SettingsImportExportStep
            {...step('connect')}
            title={t('stepConnect', { source: 'Linear' })}
          >
            <SettingsImportExportLinearConnectForm
              projectKey={projectKey}
              initial={connection}
              onTested={onTested}
            />
          </SettingsImportExportStep>

          <SettingsImportExportStep
            {...step('scope')}
            onChange={pickAgain}
            title={t('linear.stepScope')}
            summary={team && projectName ? `${team.name} · ${projectName}` : undefined}
          >
            {connection && (
              <SettingsImportExportLinearScopePicker
                teams={connection.teams}
                team={team}
                projectChoice={projectChoice}
                onTeamChange={onTeamChange}
                onProjectChoiceChange={(choice) => {
                  setProjectChoice(choice);
                  open('review');
                }}
              />
            )}
          </SettingsImportExportStep>

          <SettingsImportExportStep {...step('review')} title={t('stepReview')}>
            {connection && team && projectChoice && (
              <SettingsImportExportMappingReview
                key={`${team.id}:${projectChoice}`}
                projectKey={projectKey}
                target={{
                  source: 'linear',
                  apiToken: connection.apiToken,
                  team,
                  projectId: projectChoice === NO_PROJECT ? null : projectChoice,
                }}
                onImported={pickAgain}
              />
            )}
          </SettingsImportExportStep>
        </ol>
      </SettingsCard>
    </SettingsSection>
  );
}
