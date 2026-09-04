import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/usePermissions';
import { useGitSettingsQuery, useUpdateGitSettings } from '../../services/settings.service';
import GitConnectionCard from './GitConnectionCard';
import GitAutomationsCard from './GitAutomationsCard';
import GitProviderConnections from './GitProviderConnections';
import GitRepositoryList from './GitRepositoryList';
import SettingsSection from '@/components/common/page/SettingsSection';

// The repository integration tab: a master switch, and — while it is on — the
// webhook connection and the pull request automations. Every control writes
// immediately; there is no form-level save.
export default function SettingsGit({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.git');
  const projectKey = project.project.key;
  const { can } = usePermissions();
  const settingsQuery = useGitSettingsQuery(projectKey);
  const updateSettings = useUpdateGitSettings(projectKey);

  if (settingsQuery.isPending || !settingsQuery.data)
    return <ListSkeleton rows={3} rowClassName="h-16" />;

  const settings = settingsQuery.data;
  const editable = can('integrations', 'edit');
  return (
    <div className="space-y-10">
      <SettingsCard>
        <SettingsRow
          title={t('enable')}
          description={t('enableHint')}
          control={
            <Switch
              checked={settings.enabled}
              disabled={!editable}
              onCheckedChange={(enabled) => updateSettings.mutate({ enabled })}
            />
          }
        />
      </SettingsCard>
      {settings.enabled && (
        <>
          <GitConnectionCard projectKey={projectKey} settings={settings} editable={editable} />
          <GitProviderConnections projectKey={projectKey} editable={editable} />
          <GitAutomationsCard
            columns={project.columns}
            settings={settings}
            editable={editable}
            onChange={(patch) => updateSettings.mutate(patch)}
          />
          <SettingsSection title={t('repositories')} description={t('repositoriesHint')}>
            <SettingsCard>
              <GitRepositoryList repositories={settings.repositories} />
            </SettingsCard>
          </SettingsSection>
        </>
      )}
    </div>
  );
}
