import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import AgentRunExternalTrace from '@/components/common/agent-runs/AgentRunExternalTrace';
import AgentRunInternalTrace from '@/components/common/agent-runs/AgentRunInternalTrace';
import RunnerQueueRunHeader from './RunnerQueueRunHeader';
import RunnerQueueRunFacts from './RunnerQueueRunFacts';
import RunnerQueueRunResult from './RunnerQueueRunResult';
import RunnerQueueRunSection from './RunnerQueueRunSection';

export default function RunnerQueueRunDetail({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const failing = run.executionState === 'failed' || run.executionState === 'queued';
  return (
    <article className="space-y-8">
      <div className="space-y-6">
        <RunnerQueueRunHeader run={run} />
        <RunnerQueueRunFacts run={run} />
      </div>
      {failing && run.lastError && (
        <RunnerQueueRunSection title={t('error')}>
          <p className="text-[15px] whitespace-pre-wrap text-destructive" dir="auto">
            {run.lastError}
          </p>
        </RunnerQueueRunSection>
      )}
      {run.output && <RunnerQueueRunResult output={run.output} />}
      <RunnerQueueRunSection title={t('task')}>
        <p className="text-sm whitespace-pre-wrap text-muted-foreground" dir="auto">
          {run.prompt}
        </p>
      </RunnerQueueRunSection>
      <RunnerQueueRunSection title={t('stepsSection')}>
        {run.kind === 'internal' ? (
          <AgentRunInternalTrace runId={run.id} />
        ) : (
          <AgentRunExternalTrace runId={run.id} />
        )}
      </RunnerQueueRunSection>
    </article>
  );
}
