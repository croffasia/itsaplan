import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/usePermissions';
import { useGithubSettingsQuery, useUpdateGithubSettings } from '../../services/settings.service';
import GithubConnectionCard from './GithubConnectionCard';
import GithubAutomationsCard from './GithubAutomationsCard';

// The GitHub settings tab: a master switch, and — while it is on — the webhook
// connection and the pull request automations. Every control writes immediately;
// there is no form-level save.
export default function SettingsGithub({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.github');
  const projectKey = project.project.key;
  const { can } = usePermissions();
  const settingsQuery = useGithubSettingsQuery(projectKey);
  const updateSettings = useUpdateGithubSettings(projectKey);

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
          <GithubConnectionCard projectKey={projectKey} settings={settings} editable={editable} />
          <GithubAutomationsCard
            columns={project.columns}
            settings={settings}
            editable={editable}
            onChange={(patch) => updateSettings.mutate(patch)}
          />
        </>
      )}
    </div>
  );
}
