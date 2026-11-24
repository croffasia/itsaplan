import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import { useGitSettingsQuery, useUpdateGitSettings } from '../../services/settings.service';
import GitConnectionCard from './GitConnectionCard';
import GitAutomationsCard from './GitAutomationsCard';
import GitRepositories from './GitRepositories';

// Every control writes immediately; there is no form-level save.
export default function SettingsGit({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.git');
  const projectKey = project.project.ref;
  const settingsQuery = useGitSettingsQuery(projectKey);
  const updateSettings = useUpdateGitSettings(projectKey);

  if (settingsQuery.isPending || !settingsQuery.data)
    return <ListSkeleton rows={3} rowClassName="h-16" />;

  const settings = settingsQuery.data;
  return (
    <div className="space-y-10">
      <SettingsCard>
        <SettingsRow
          title={t('enable')}
          description={t('enableHint')}
          control={
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => updateSettings.mutate({ enabled })}
            />
          }
        />
      </SettingsCard>
      {settings.enabled && (
        <>
          <GitRepositories project={project} settings={settings} />
          <GitAutomationsCard
            columns={project.columns}
            settings={settings}
            onChange={(patch) => updateSettings.mutate(patch)}
          />
          <GitConnectionCard projectKey={projectKey} settings={settings} />
        </>
      )}
    </div>
  );
}
