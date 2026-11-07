import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { TrelloBoardOption, TrelloConnectionInput } from '@/lib/api/endpoints/importExport';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportTrelloConnectForm from './SettingsImportExportTrelloConnectForm';
import SettingsImportExportTrelloBoardPicker from './SettingsImportExportTrelloBoardPicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';

export interface TrelloConnection extends TrelloConnectionInput {
  boards: TrelloBoardOption[];
}

// The Trello source on the Import tab: authorize an API key, pick a board, review the
// list mapping, archived cards and members, start the job.
export default function SettingsImportExportTrello({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const [connection, setConnection] = useState<TrelloConnection | null>(null);
  const [board, setBoard] = useState<TrelloBoardOption | null>(null);

  function onTested(next: TrelloConnection) {
    setConnection(next);
    setBoard(null);
  }

  return (
    <>
      <SettingsSection title={t('trello.connect')} description={t('trello.connectHint')}>
        <SettingsCard className="p-4">
          <SettingsImportExportTrelloConnectForm projectKey={projectKey} onTested={onTested} />
        </SettingsCard>
      </SettingsSection>
      {connection && (
        <SettingsSection title={t('trello.scope')} description={t('trello.scopeHint')}>
          <SettingsCard className="space-y-6 p-4">
            <SettingsImportExportTrelloBoardPicker
              boards={connection.boards}
              selected={board}
              onSelect={setBoard}
            />
            {board && (
              <SettingsImportExportMappingReview
                key={board.id}
                projectKey={projectKey}
                target={{
                  source: 'trello',
                  connection: { apiKey: connection.apiKey, apiToken: connection.apiToken },
                  board,
                  people: project.assignees.filter((a) => a.kind === 'member'),
                }}
                onImported={() => setBoard(null)}
              />
            )}
          </SettingsCard>
        </SettingsSection>
      )}
    </>
  );
}
