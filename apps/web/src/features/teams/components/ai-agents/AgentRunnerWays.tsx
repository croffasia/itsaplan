import { Code2, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AgentRunnerCodeBlock } from './AgentRunnerCodeBlock';
import { AgentRunnerHelpSheet, RUN_COMMAND } from './AgentRunnerHelpSheet';

// The two ways to run something that takes an external agent's tasks: the runner CLI,
// or code of one's own against the runner routes.
export function AgentRunnerWays() {
  const t = useTranslations('teams.agents');

  return (
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
  );
}
