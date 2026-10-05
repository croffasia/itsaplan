'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import {
  useInstanceAuthSettingsQuery,
  useInstanceProjectDefaultsQuery,
  useUpdateInstanceAuthSettings,
  useUpdateInstanceProjectDefaults,
} from './services/god.service';
import type { InstanceAuthSettings } from '@/lib/api/endpoints/god';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';

export default function GodGeneralPage() {
  const defaults = useInstanceProjectDefaultsQuery().data;
  const auth = useInstanceAuthSettingsQuery().data;

  return (
    <GodSettingsGate slug="general" data={defaults && auth ? { defaults, auth } : undefined}>
      {(data) => <GeneralForm {...data} />}
    </GodSettingsGate>
  );
}

// Personal workspaces are stored with the auth settings, because sign-up reads them;
// the switch sits here, since it is about how people work, not how they sign in.
function GeneralForm({
  defaults,
  auth,
}: {
  defaults: ProjectDefaults;
  auth: InstanceAuthSettings;
}) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceProjectDefaults();
  const updateAuth = useUpdateInstanceAuthSettings();

  // Single toggles, so each saves on change rather than behind a Save button.
  async function setMcpEnabled(mcpEnabled: boolean) {
    try {
      await update.mutateAsync({ ...defaults, mcpEnabled });
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  async function setPersonalWorkspaces(personalWorkspaces: boolean) {
    try {
      await updateAuth.mutateAsync({ personalWorkspaces });
      toast.success(t('workspacesSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage slug="general">
      <div className="space-y-10">
        <SettingsSection title={t('workspaces')}>
          <SettingsCard>
            <SettingsRow
              title={t('personalWorkspaces')}
              description={t('personalWorkspacesHint')}
              control={
                <Switch
                  checked={auth.personalWorkspaces}
                  disabled={updateAuth.isPending}
                  onCheckedChange={(checked) => void setPersonalWorkspaces(checked)}
                />
              }
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('projectDefaults')}>
          <SettingsCard>
            <SettingsRow
              title={t('mcpEnabled')}
              description={t('mcpEnabledHint')}
              control={
                <Switch
                  checked={defaults.mcpEnabled}
                  disabled={update.isPending}
                  onCheckedChange={(checked) => void setMcpEnabled(checked)}
                />
              }
            />
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
