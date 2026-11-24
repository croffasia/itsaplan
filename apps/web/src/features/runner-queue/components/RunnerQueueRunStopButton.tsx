import { CircleStop } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { useCancelAgentRun } from '@/services/runnerQueue.service';
import { Button } from '@/components/ui/button';

// Whoever reads a run's steps manages it, and so stops it.
export default function RunnerQueueRunStopButton({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const cancel = useCancelAgentRun();
  if (!run.canReadSteps) return null;
  if (run.executionState !== 'queued' && run.executionState !== 'running') return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={cancel.isPending}
      onClick={() => cancel.mutate(run.id)}
    >
      <CircleStop />
      {t('stop')}
    </Button>
  );
}
