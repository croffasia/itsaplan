import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { TrelloBoardOption, TrelloConnectionInput } from '@/lib/api/endpoints/importExport';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { useImportSteps } from '../../hooks/useImportSteps';
import SettingsImportExportTrelloConnectForm from './SettingsImportExportTrelloConnectForm';
import SettingsImportExportTrelloBoardPicker from './SettingsImportExportTrelloBoardPicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';
import SettingsImportExportStep from './SettingsImportExportStep';

export interface TrelloConnection extends TrelloConnectionInput {
  boards: TrelloBoardOption[];
}

const STEPS = ['connect', 'board', 'review'] as const;

// The Trello source on the Import tab, one step at a time: authorize an API key, pick a
// board, review the list mapping, archived cards and members, and start the job.
export default function SettingsImportExportTrello({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const [connection, setConnection] = useState<TrelloConnection | null>(null);
  const [board, setBoard] = useState<TrelloBoardOption | null>(null);
  const { open, step } = useImportSteps(STEPS);

  function onTested(next: TrelloConnection) {
    setConnection(next);
    setBoard(null);
    open('board');
  }

  // A picked board is cleared on the way back: a select does not report picking it again.
  function pickAgain() {
    setBoard(null);
    open('board');
  }

  return (
    <SettingsSection title={t('title', { source: 'Trello' })} description={t('trello.connectHint')}>
      <SettingsCard className="p-6">
        <ol>
          <SettingsImportExportStep
            {...step('connect')}
            title={t('stepConnect', { source: 'Trello' })}
          >
            <SettingsImportExportTrelloConnectForm
              projectKey={projectKey}
              initial={connection}
              onTested={onTested}
            />
          </SettingsImportExportStep>

          <SettingsImportExportStep
            {...step('board')}
            onChange={pickAgain}
            title={t('trello.stepBoard')}
            summary={board?.name}
          >
            {connection && (
              <SettingsImportExportTrelloBoardPicker
                boards={connection.boards}
                selected={board}
                onSelect={(next) => {
                  setBoard(next);
                  open('review');
                }}
              />
            )}
          </SettingsImportExportStep>

          <SettingsImportExportStep {...step('review')} title={t('stepReview')}>
            {connection && board && (
              <SettingsImportExportMappingReview
                key={board.id}
                projectKey={projectKey}
                target={{
                  source: 'trello',
                  connection: { apiKey: connection.apiKey, apiToken: connection.apiToken },
                  board,
                  people: project.assignees.filter((a) => a.kind === 'member'),
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
