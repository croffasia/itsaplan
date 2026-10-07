import { Terminal } from 'lucide-react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { useTranslations } from 'next-intl';

export function SettingsScheduleRunnerHint({ agent }: { agent: AiAgent }) {
  const t = useTranslations('settings.schedules');
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
      <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground">{t('externalAgentHint')}</p>
        <AgentRunnerStatus agent={agent} />
      </div>
    </div>
  );
}
