import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { formatDateTime } from '@/utils/dates';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';

export default function RunnerQueueRunFacts({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const tKind = useTranslations('teams.agents.kindLabel');
  const facts: [string, ReactNode][] = [
    [t('facts.agent'), `@${run.username} · ${tKind(run.kind)}`],
    [t('facts.trigger'), t(`triggers.${run.trigger}`)],
  ];
  if (run.startedAt) facts.push([t('facts.started'), formatDateTime(run.startedAt)]);
  if (run.finishedAt) facts.push([t('facts.finished'), formatDateTime(run.finishedAt)]);
  facts.push([t('facts.attempts'), run.attempts]);
  if (run.runnerState) {
    facts.push([
      run.runnerState === 'push' ? t('facts.delivery') : t('facts.runner'),
      t(`connection.${run.runnerState}`),
    ]);
  }
  if (run.contextTokens != null) {
    facts.push([t('facts.context'), <AgentContextSize key="context" tokens={run.contextTokens} />]);
  }
  facts.push([t('facts.run'), `#${run.id}`]);
  return (
    <dl className="flex flex-wrap gap-x-9 gap-y-4">
      {facts.map(([label, value]) => (
        <div key={label} className="space-y-1">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
