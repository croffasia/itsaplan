import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { GitProviderConnection, GitSettings } from '@/lib/api/endpoints/git';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { useGitProviderConnectionsQuery } from '../../services/settings.service';
import {
  accountForHost,
  managedRepositories,
  manualRepositories,
} from '../../utils/gitRepositories';
import GitConnectRepositoryButton from './GitConnectRepositoryButton';
import GitManagedRepositoryRow from './GitManagedRepositoryRow';
import GitManualRepositoryRow from './GitManualRepositoryRow';
import GitRepositoryPickerDialog from './GitRepositoryPickerDialog';
import GitRepositorySettingsDialog from './GitRepositorySettingsDialog';

// Every repository of the project in one list: the ones connected through a provider
// account, then the ones that deliver through a webhook made by hand.
export default function GitRepositories({
  project,
  settings,
}: {
  project: ProjectDetail;
  settings: GitSettings;
}) {
  const t = useTranslations('settings.git');
  const projectKey = project.project.ref;
  const connectionsQuery = useGitProviderConnectionsQuery(projectKey);
  const [picker, setPicker] = useState<{
    connection: GitProviderConnection;
    search: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const canManageTeam =
    project.viewer.teamRole === 'owner' || project.viewer.teamRole === 'manager';

  const connections = connectionsQuery.data ?? [];
  const managed = managedRepositories(connections);
  const manual = manualRepositories(settings.repositories, managed);
  const editing = managed.find((entry) => entry.repository.id === editingId);

  let content: ReactNode;
  if (connectionsQuery.isPending) content = <ListSkeleton rows={2} rowClassName="h-14" />;
  else if (managed.length === 0 && manual.length === 0)
    content = (
      <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
        <p>{t('noRepositories')}</p>
        {connections.length === 0 && !canManageTeam && <p>{t('nativeAskTeamManager')}</p>}
      </div>
    );
  else
    content = (
      <SettingsCard className="divide-y divide-border/60">
        {managed.map(({ connection, repository }) => (
          <GitManagedRepositoryRow
            key={repository.id}
            projectKey={projectKey}
            connection={connection}
            repository={repository}
            onOpenSettings={() => setEditingId(repository.id)}
          />
        ))}
        {manual.map((repository) => {
          const account = accountForHost(connections, repository.provider);
          return (
            <GitManualRepositoryRow
              key={`${repository.provider}/${repository.repo}`}
              repository={repository}
              onConnect={
                account && (() => setPicker({ connection: account, search: repository.repo }))
              }
            />
          );
        })}
      </SettingsCard>
    );

  return (
    <SettingsSection
      title={t('repositories')}
      description={t('repositoriesHint')}
      action={
        <GitConnectRepositoryButton
          connections={connections}
          teamRef={project.project.teamRef}
          canManageTeam={canManageTeam}
          onPick={(connection) => setPicker({ connection, search: '' })}
        />
      }
    >
      {content}
      {picker && (
        <GitRepositoryPickerDialog
          projectKey={projectKey}
          connection={picker.connection}
          initialSearch={picker.search}
          open
          onOpenChange={(open) => !open && setPicker(null)}
        />
      )}
      {editing && (
        <GitRepositorySettingsDialog
          project={project}
          repository={editing.repository}
          onClose={() => setEditingId(null)}
        />
      )}
    </SettingsSection>
  );
}
