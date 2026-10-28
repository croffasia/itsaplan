'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import GodEmbedSitesSection from './components/general/GodEmbedSitesSection';
import {
  useInstanceAgentSettingsQuery,
  useInstanceAuthSettingsQuery,
  useInstanceEmbedSitesQuery,
  useInstanceProjectDefaultsQuery,
  useUpdateInstanceAgentSettings,
  useUpdateInstanceAuthSettings,
  useUpdateInstanceProjectDefaults,
} from './services/god.service';
import type { AgentSettings, EmbedSites, InstanceAuthSettings } from '@/lib/api/endpoints/god';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';

// The trace windows offered; a window stored through the API outside them is offered too.
const TRACE_DAYS = [7, 30, 90, 365];
// The run time maximums offered, in seconds; a stored value outside them is offered too.
const RUN_SECONDS = [120, 240, 300, 600, 900, 1800, 3600];
// The highest run limit the api takes.
const MAX_RUN_LIMIT = 1000;

export default function GodGeneralPage() {
  const defaults = useInstanceProjectDefaultsQuery().data;
  const auth = useInstanceAuthSettingsQuery().data;
  const agents = useInstanceAgentSettingsQuery().data;
  const embed = useInstanceEmbedSitesQuery().data;

  return (
    <GodSettingsGate
      slug="general"
      data={defaults && auth && agents && embed ? { defaults, auth, agents, embed } : undefined}
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
  embed,
}: {
  defaults: ProjectDefaults;
  auth: InstanceAuthSettings;
  agents: AgentSettings;
  embed: EmbedSites;
}) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceProjectDefaults();
  const updateAuth = useUpdateInstanceAuthSettings();
  const updateAgents = useUpdateInstanceAgentSettings();
  const traceDays = [...new Set([...TRACE_DAYS, agents.traceRetentionDays])]
    .filter((days) => days > 0)
    .sort((a, b) => a - b);
  const runSeconds = [...new Set([...RUN_SECONDS, agents.maxRunSeconds])].sort((a, b) => a - b);
  // The run limit as typed, or null while it shows the stored one.
  const [runLimitDraft, setRunLimitDraft] = useState<string | null>(null);
  const runLimit = runLimitDraft ?? String(agents.maxConcurrentRuns);
  const runLimitValid = /^\d+$/.test(runLimit.trim()) && Number(runLimit) <= MAX_RUN_LIMIT;

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

  async function setAgentSettings(patch: Partial<AgentSettings>) {
    try {
      await updateAgents.mutateAsync(patch);
      toast.success(t('agentsSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  // A typed number, so it saves on leaving the field or Enter rather than on each key.
  async function saveRunLimit() {
    if (runLimitDraft === null || !runLimitValid) return;
    if (Number(runLimitDraft) !== agents.maxConcurrentRuns) {
      await setAgentSettings({ maxConcurrentRuns: Number(runLimitDraft) });
    }
    setRunLimitDraft(null);
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
                  onValueChange={(value) =>
                    void setAgentSettings({ traceRetentionDays: Number(value) })
                  }
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
            <SettingsRow
              title={t('maxRunTime')}
              description={t('maxRunTimeHint')}
              control={
                <Select
                  value={String(agents.maxRunSeconds)}
                  disabled={updateAgents.isPending}
                  onValueChange={(value) => void setAgentSettings({ maxRunSeconds: Number(value) })}
                >
                  <SelectTrigger className="w-36" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {runSeconds.map((seconds) => (
                      <SelectItem key={seconds} value={String(seconds)}>
                        {seconds % 60 === 0
                          ? t('runMinutes', { minutes: seconds / 60 })
                          : t('runSeconds', { seconds })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <SettingsRow
              title={t('concurrentRuns')}
              description={t('concurrentRunsHint')}
              note={runLimitValid ? undefined : t('concurrentRunsInvalid', { max: MAX_RUN_LIMIT })}
              control={
                <Input
                  type="number"
                  min={0}
                  max={MAX_RUN_LIMIT}
                  step={1}
                  inputMode="numeric"
                  className="w-24"
                  aria-label={t('concurrentRuns')}
                  aria-invalid={!runLimitValid}
                  value={runLimit}
                  disabled={updateAgents.isPending}
                  onChange={(e) => setRunLimitDraft(e.target.value)}
                  onBlur={() => void saveRunLimit()}
                  onKeyDown={(e) => e.key === 'Enter' && void saveRunLimit()}
                />
              }
            />
          </SettingsCard>
        </SettingsSection>

        <GodEmbedSitesSection sites={embed} />
      </div>
    </GodSectionPage>
  );
}
