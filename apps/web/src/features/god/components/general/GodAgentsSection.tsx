'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { AgentSettings } from '@/lib/api/endpoints/god';
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
import { useUpdateInstanceAgentSettings } from '../../services/god.service';
import GodLimitRow from './GodLimitRow';

// The trace windows offered; a window stored through the API outside them is offered too.
const TRACE_DAYS = [7, 30, 90, 365];
// The run time maximums offered, in seconds; a stored value outside them is offered too.
const RUN_SECONDS = [120, 240, 300, 600, 900, 1800, 3600];
// The highest run limit and answer limit the api takes.
const MAX_RUN_LIMIT = 1000;
const MAX_ANSWER_CHARS = 10_000_000;

export default function GodAgentsSection({ agents }: { agents: AgentSettings }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceAgentSettings();
  const traceDays = [...new Set([...TRACE_DAYS, agents.traceRetentionDays])]
    .filter((days) => days > 0)
    .sort((a, b) => a - b);
  const runSeconds = [...new Set([...RUN_SECONDS, agents.maxRunSeconds])].sort((a, b) => a - b);

  async function setAgentSettings(patch: Partial<AgentSettings>) {
    try {
      await update.mutateAsync(patch);
      toast.success(t('agentsSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
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
        <GodLimitRow
          title={t('concurrentRuns')}
          description={t('concurrentRunsHint')}
          value={agents.maxConcurrentRuns}
          max={MAX_RUN_LIMIT}
          invalidNote={t('concurrentRunsInvalid', { max: MAX_RUN_LIMIT })}
          disabled={update.isPending}
          inputClassName="w-24"
          onSave={(value) => setAgentSettings({ maxConcurrentRuns: value })}
        />
        <GodLimitRow
          title={t('answerLimit')}
          description={t('answerLimitHint')}
          value={agents.maxAnswerChars}
          max={MAX_ANSWER_CHARS}
          invalidNote={t('answerLimitInvalid', { max: MAX_ANSWER_CHARS })}
          zeroNote={t('answerLimitNone')}
          disabled={update.isPending}
          inputClassName="w-32"
          onSave={(value) => setAgentSettings({ maxAnswerChars: value })}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
