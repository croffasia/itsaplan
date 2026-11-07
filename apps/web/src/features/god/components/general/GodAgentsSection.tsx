'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { AgentSettings } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateInstanceAgentSettings } from '../../services/god.service';

// The trace windows offered; a window stored through the API outside them is offered too.
const TRACE_DAYS = [7, 30, 90, 365];
// The run time maximums offered, in seconds; a stored value outside them is offered too.
const RUN_SECONDS = [120, 240, 300, 600, 900, 1800, 3600];
// The highest run limit the api takes.
const MAX_RUN_LIMIT = 1000;

export default function GodAgentsSection({ agents }: { agents: AgentSettings }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceAgentSettings();
  const traceDays = [...new Set([...TRACE_DAYS, agents.traceRetentionDays])]
    .filter((days) => days > 0)
    .sort((a, b) => a - b);
  const runSeconds = [...new Set([...RUN_SECONDS, agents.maxRunSeconds])].sort((a, b) => a - b);
  // The run limit as typed, or null while it shows the stored one.
  const [runLimitDraft, setRunLimitDraft] = useState<string | null>(null);
  const runLimit = runLimitDraft ?? String(agents.maxConcurrentRuns);
  const runLimitValid = /^\d+$/.test(runLimit.trim()) && Number(runLimit) <= MAX_RUN_LIMIT;

  async function setAgentSettings(patch: Partial<AgentSettings>) {
    try {
      await update.mutateAsync(patch);
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
    <SettingsSection title={t('agents')}>
      <SettingsCard>
        <SettingsRow
          title={t('traceRetention')}
          description={t('traceRetentionHint')}
          control={
            <Select
              value={String(agents.traceRetentionDays)}
              disabled={update.isPending}
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
              disabled={update.isPending}
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
              disabled={update.isPending}
              onChange={(e) => setRunLimitDraft(e.target.value)}
              onBlur={() => void saveRunLimit()}
              onKeyDown={(e) => e.key === 'Enter' && void saveRunLimit()}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
