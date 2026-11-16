import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AgentRunExternalTrace from '@/components/common/agent-runs/AgentRunExternalTrace';
import AgentRunInternalTrace from '@/components/common/agent-runs/AgentRunInternalTrace';
import { useRunSteps } from '../hooks/useRunSteps';
import RunnerQueueRunHeader from './RunnerQueueRunHeader';
import RunnerQueueRunNotice from './RunnerQueueRunNotice';
import RunnerQueueRunProperties from './RunnerQueueRunProperties';
import RunnerQueueRunResult from './RunnerQueueRunResult';
import RunnerQueueRunTask from './RunnerQueueRunTask';

type Tab = 'result' | 'steps' | 'task';

// A run opens on what it produced once it answered, on what it did while it runs or after
// it failed, and on what it was asked while it has not started.
function firstTab(run: RunnerQueueRun): Tab {
  if (run.output && run.executionState === 'success') return 'result';
  if (run.executionState === 'queued' || run.executionState === 'canceled') {
    return run.attempts > 0 ? 'steps' : 'task';
  }
  return 'steps';
}

export default function RunnerQueueRunDetail({
  run,
  listPath,
}: {
  run: RunnerQueueRun;
  listPath: string;
}) {
  const t = useTranslations('issue.agentRuns');
  const [tab, setTab] = useState(() => firstTab(run));
  const steps = useRunSteps(run);
  const failedStep = steps?.some((part) => part.error) ?? false;
  const toolCalls = steps?.filter((part) => part.type === 'tool').length ?? 0;
  const panels = useRef<HTMLDivElement>(null);

  function showFailedStep() {
    setTab('steps');
    // The tab renders on this commit, before the next frame.
    requestAnimationFrame(() =>
      panels.current?.querySelector('[data-step-error]')?.scrollIntoView({ block: 'center' }),
    );
  }

  return (
    <article className="@container space-y-6">
      <RunnerQueueRunHeader run={run} listPath={listPath} />
      <RunnerQueueRunNotice run={run} onShowFailedStep={failedStep ? showFailedStep : undefined} />
      <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_340px] @5xl:gap-10">
        <Tabs
          ref={panels}
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          className="min-w-0 gap-5"
        >
          <TabsList variant="line">
            <TabsTrigger value="result">{t('result')}</TabsTrigger>
            <TabsTrigger value="steps">
              {t('stepsTab')}
              {toolCalls > 0 && (
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {toolCalls}
                </span>
              )}
              {failedStep && (
                <span
                  role="img"
                  aria-label={t('failed')}
                  className="size-1.5 rounded-full bg-destructive"
                />
              )}
            </TabsTrigger>
            <TabsTrigger value="task">{t('task')}</TabsTrigger>
          </TabsList>
          <TabsContent value="result">
            <RunnerQueueRunResult run={run} />
          </TabsContent>
          <TabsContent value="steps">
            {run.kind === 'internal' ? (
              <AgentRunInternalTrace runId={run.id} />
            ) : (
              <AgentRunExternalTrace runId={run.id} />
            )}
          </TabsContent>
          <TabsContent value="task">
            <RunnerQueueRunTask prompt={run.prompt} />
          </TabsContent>
        </Tabs>
        <RunnerQueueRunProperties run={run} />
      </div>
    </article>
  );
}
