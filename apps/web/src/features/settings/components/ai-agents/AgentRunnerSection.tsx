import { Code2, Package, Terminal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { AgentFormSection } from './AgentFormSection';
import { AgentRunnerCodeBlock } from './AgentRunnerCodeBlock';
import { AgentRunnerHelpSheet, RUN_COMMAND } from './AgentRunnerHelpSheet';

// The Runner section of an external agent: whether its runner is connected right
// now, and how to start one. Who may give the agent work is an access question and
// lives in the Access section, so nothing here is a setting.
export default function AgentRunnerSection({
  agent,
  ...section
}: {
  // The saved agent, for its presence. Null while creating: no key exists yet, so the
  // state reads as not connected.
  agent: AiAgent | null;
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.agents');

  return (
    <AgentFormSection
      {...section}
      icon={Terminal}
      title={t('runner')}
      hint={t('runnerHint')}
      // Presence belongs in the header: it is the section's state at a glance, and it
      // stays visible while the section is collapsed.
      headerRight={<AgentRunnerStatus agent={agent} compact />}
    >
      <div className="space-y-3">
        <div className="space-y-2 rounded-md border p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Package className="size-4 text-muted-foreground" />
            {t('runnerWayCli')}
          </p>
          <p className="text-xs text-muted-foreground">{t('runnerWayCliHint')}</p>
          <AgentRunnerCodeBlock code={RUN_COMMAND} />
          <AgentRunnerHelpSheet />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Code2 className="size-4 text-muted-foreground" />
            {t('runnerWayApi')}
          </p>
          <p className="text-xs text-muted-foreground">{t('runnerWayApiHint')}</p>
        </div>
      </div>
    </AgentFormSection>
  );
}
