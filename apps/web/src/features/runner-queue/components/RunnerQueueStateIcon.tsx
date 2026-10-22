import { Ban, CircleCheck, CircleX, Clock, LoaderCircle, Send } from 'lucide-react';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';

const STATE_ICON = {
  running: [LoaderCircle, 'animate-spin'],
  queued: [Clock, 'text-warning'],
  success: [CircleCheck, 'text-muted-foreground'],
  failed: [CircleX, 'text-destructive'],
  canceled: [Ban, 'text-muted-foreground'],
} as const;

export default function RunnerQueueStateIcon({
  run,
  className,
}: {
  run: RunnerQueueRun;
  className?: string;
}) {
  const [StateIcon, tone] = STATE_ICON[run.executionState];
  const Icon = run.executionState === 'queued' && run.runnerState === 'push' ? Send : StateIcon;
  return <Icon aria-hidden className={cn('shrink-0', tone, className)} />;
}
