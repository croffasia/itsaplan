'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import {
  useInstanceAgentSettingsQuery,
  useInstanceProjectDefaultsQuery,
  useUpdateInstanceAgentSettings,
  useUpdateInstanceProjectDefaults,
} from './services/god.service';
import type { AgentSettings } from '@/lib/api/endpoints/god';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';

// Prefilled when trace deletion is switched on, and what the api starts at.
const DEFAULT_TRACE_DAYS = 30;

export default function GodGeneralPage() {
  const defaults = useInstanceProjectDefaultsQuery();
  const agents = useInstanceAgentSettingsQuery();
  const loaded =
    defaults.data && agents.data ? { defaults: defaults.data, agents: agents.data } : undefined;

  return (
    <GodSettingsGate slug="general" data={loaded}>
      {(data) => <GeneralForm defaults={data.defaults} agents={data.agents} />}
    </GodSettingsGate>
  );
}

function GeneralForm({ defaults, agents }: { defaults: ProjectDefaults; agents: AgentSettings }) {
  const t = useTranslations('god.general');
  const tCommon = useTranslations('common');
  const update = useUpdateInstanceProjectDefaults();
  const updateAgents = useUpdateInstanceAgentSettings();

  // 0 days keeps every trace, which is what the switch reads as off.
  const [tracesOn, setTracesOn] = useState(agents.traceRetentionDays > 0);
  const [traceDays, setTraceDays] = useState(
    String(agents.traceRetentionDays || DEFAULT_TRACE_DAYS),
  );

  const days = Number(traceDays);
  const valid = !tracesOn || (Number.isInteger(days) && days >= 1 && days <= 3650);
  const dirty =
    tracesOn !== agents.traceRetentionDays > 0 || (tracesOn && days !== agents.traceRetentionDays);

  // A single toggle, so it saves on change rather than behind a Save button.
  async function setMcpEnabled(mcpEnabled: boolean) {
    try {
      await update.mutateAsync({ ...defaults, mcpEnabled });
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  async function saveAgents() {
    try {
      await updateAgents.mutateAsync({ traceRetentionDays: tracesOn ? days : 0 });
      toast.success(t('agentsSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="general"
      actions={
        <Button
          size="sm"
          onClick={() => void saveAgents()}
          disabled={!dirty || !valid || updateAgents.isPending}
        >
          {updateAgents.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-8">
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

        <SettingsSection title={t('traces')} description={t('tracesHint')}>
          <SettingsCard>
            <SettingsRow
              title={t('traceRetention')}
              description={t('traceRetentionHint')}
              control={
                <div className="flex shrink-0 items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={traceDays}
                    onChange={(e) => setTraceDays(e.target.value)}
                    disabled={!tracesOn}
                    className="h-8 w-20"
                  />
                  <span className="text-xs text-muted-foreground">{t('days')}</span>
                  <Switch checked={tracesOn} onCheckedChange={setTracesOn} />
                </div>
              }
            />
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
