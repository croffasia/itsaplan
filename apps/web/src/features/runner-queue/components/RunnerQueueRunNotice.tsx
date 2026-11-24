import Link from 'next/link';
import { Clock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { waitsForRunner } from '../utils/waitsForRunner';

// Why a run waits for its runner, with the way to the agents where its runner is set up;
// or the error that stopped the run or delays its retry, with the way to the failed step
// when the steps show one.
export default function RunnerQueueRunNotice({
  run,
  onShowFailedStep,
}: {
  run: RunnerQueueRun;
  onShowFailedStep?: () => void;
}) {
  const t = useTranslations('issue.agentRuns');
  if (waitsForRunner(run)) {
    return (
      <div role="status" className="flex gap-3 rounded-xl bg-warning/10 px-4 py-3.5 text-sm">
        <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">
            {t(run.runnerState === 'never' ? 'runnerNeverFor' : 'runnerOfflineFor', {
              name: run.username,
            })}
          </p>
          <p>{t('waitingRunHint')}</p>
          <Button asChild variant="outline" size="sm" className="mt-1.5 bg-transparent">
            <Link href={aiAgentsPath(run.projectRef)}>{t('startRunner')}</Link>
          </Button>
        </div>
      </div>
    );
  }
  const failing = run.executionState === 'failed' || run.executionState === 'queued';
  if (!failing || !run.lastError) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-xl bg-destructive/10 px-4 py-3.5 text-sm">
      <X aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive-text" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">
          {run.executionState === 'failed' ? t('runError') : t('error')}
        </p>
        <p className="whitespace-pre-wrap" dir="auto">
          {run.lastError}
        </p>
        {onShowFailedStep && (
          <Button
            variant="outline"
            size="sm"
            className="mt-1.5 bg-transparent"
            onClick={onShowFailedStep}
          >
            {t('showFailedStep')}
          </Button>
        )}
      </div>
    </div>
  );
}
