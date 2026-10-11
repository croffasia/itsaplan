'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import {
  useInstanceAgentSettingsQuery,
  useInstanceAuthSettingsQuery,
  useInstanceProjectDefaultsQuery,
  useUpdateInstanceAgentSettings,
  useUpdateInstanceAuthSettings,
  useUpdateInstanceProjectDefaults,
} from './services/god.service';
import type { AgentSettings, InstanceAuthSettings } from '@/lib/api/endpoints/god';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';

// The trace windows offered; a window stored through the API outside them is offered too.
const TRACE_DAYS = [7, 30, 90, 365];

export default function GodGeneralPage() {
  const defaults = useInstanceProjectDefaultsQuery().data;
  const auth = useInstanceAuthSettingsQuery().data;
  const agents = useInstanceAgentSettingsQuery().data;

  return (
    <GodSettingsGate
      slug="general"
      data={defaults && auth && agents ? { defaults, auth, agents } : undefined}
    >
      {(data) => <GeneralForm {...data} />}
    </GodSettingsGate>
  );
}

// Personal workspaces are stored with the auth settings, because sign-up reads them;
// the switch sits here, since it is about how people work, not how they sign in.
function GeneralForm({
  defaults,
  auth,
  agents,
}: {
  defaults: ProjectDefaults;
  auth: InstanceAuthSettings;
  agents: AgentSettings;
}) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceProjectDefaults();
  const updateAuth = useUpdateInstanceAuthSettings();
  const updateAgents = useUpdateInstanceAgentSettings();
  const traceDays = [...new Set([...TRACE_DAYS, agents.traceRetentionDays])]
    .filter((days) => days > 0)
    .sort((a, b) => a - b);

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

  async function setTraceRetention(traceRetentionDays: number) {
    try {
      await updateAgents.mutateAsync({ traceRetentionDays });
      toast.success(t('agentsSaved'));
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

        <SettingsSection title={t('agents')}>
          <SettingsCard>
            <SettingsRow
              title={t('traceRetention')}
              description={t('traceRetentionHint')}
              control={
                <Select
                  value={String(agents.traceRetentionDays)}
                  disabled={updateAgents.isPending}
                  onValueChange={(value) => void setTraceRetention(Number(value))}
                >
                  <SelectTrigger className="w-36" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {traceDays.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {t('traceDays', { days })}
                      </SelectItem>
                    ))}
                    <SelectItem value="0">{t('traceForever')}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
