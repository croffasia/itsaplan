'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from '../GodSectionPage';
import GodAgentsSection from './GodAgentsSection';
import GodApiDocsSection from './GodApiDocsSection';
import GodEmbedSitesSection from './GodEmbedSitesSection';
import GodSharingSection from './GodSharingSection';
import {
  useUpdateInstanceAuthSettings,
  useUpdateInstanceProjectDefaults,
} from '../../services/god.service';
import type {
  AgentSettings,
  ApiDocsSettings,
  EmbedSites,
  InstanceAuthSettings,
  SharingSettings,
} from '@/lib/api/endpoints/god';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';

// Personal workspaces are stored with the auth settings, because sign-up reads them;
// the switch sits here, since it is about how people work, not how they sign in.
export default function GodGeneralForm({
  defaults,
  auth,
  agents,
  embed,
  sharing,
  apiDocs,
}: {
  defaults: ProjectDefaults;
  auth: InstanceAuthSettings;
  agents: AgentSettings;
  embed: EmbedSites;
  sharing: SharingSettings;
  apiDocs: ApiDocsSettings;
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

  async function setInviteSearch(inviteSearch: boolean) {
    try {
      await updateAuth.mutateAsync({ inviteSearch });
      toast.success(t('invitesSaved'));
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

        <SettingsSection title={t('invites')}>
          <SettingsCard>
            <SettingsRow
              title={t('inviteSearch')}
              description={t('inviteSearchHint')}
              control={
                <Switch
                  checked={auth.inviteSearch}
                  disabled={updateAuth.isPending}
                  onCheckedChange={(checked) => void setInviteSearch(checked)}
                />
              }
            />
          </SettingsCard>
        </SettingsSection>

        <GodSharingSection sharing={sharing} />

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

        <GodAgentsSection agents={agents} />

        <GodApiDocsSection settings={apiDocs} />

        <GodEmbedSitesSection sites={embed} />
      </div>
    </GodSectionPage>
  );
}
