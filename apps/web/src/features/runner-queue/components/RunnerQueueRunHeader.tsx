import Link from 'next/link';
import {
  ArrowUpRight,
  Ban,
  Check,
  ChevronLeft,
  Clock,
  Link2,
  LoaderCircle,
  Send,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { outcomeDetail } from '../utils/outcomeDetail';
import { runIssueKey } from '../utils/runIssueKey';
import { waitsForRunner } from '../utils/waitsForRunner';

const OUTCOME = {
  success: [Check, 'bg-green-500/15 text-green-500'],
  failed: [X, 'bg-destructive/15 text-destructive-text'],
  running: [LoaderCircle, 'bg-muted [&>svg]:animate-spin motion-reduce:[&>svg]:animate-none'],
  queued: [Clock, 'bg-warning/15 text-warning'],
  canceled: [Ban, 'bg-muted text-muted-foreground'],
} as const;

// How the run went and what it ran on, with its links. A phone, which hides the list while
// a run is open, also gets the way back to it.
export default function RunnerQueueRunHeader({
  run,
  listPath,
}: {
  run: RunnerQueueRun;
  listPath: string;
}) {
  const t = useTranslations('issue.agentRuns');
  const relativeTime = useRelativeTime();
  const [StateIcon, tone] = OUTCOME[run.executionState];
  const Icon = run.executionState === 'queued' && run.runnerState === 'push' ? Send : StateIcon;
  const detail = outcomeDetail(run, t, relativeTime);
  const issueKey = runIssueKey(run);
  const href = run.sequenceNumber == null ? null : issuePath(run.projectRef, run.sequenceNumber);
  const hasSubtitle = href !== null || !!run.scheduleName;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('linkCopied'));
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  return (
    <header className="space-y-4">
      <Link
        href={listPath}
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground md:hidden"
      >
        <ChevronLeft aria-hidden className="size-3.5 rtl:rotate-180" />
        {t('queueTitle')}
      </Link>
      <div
        className={cn(
          'flex flex-wrap gap-x-3.5 gap-y-3',
          hasSubtitle ? 'items-start' : 'items-center',
        )}
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h2 className="text-xl font-semibold">
            {waitsForRunner(run) ? t('waitingForRunner') : t(run.executionState)}
            {detail && <span className="font-normal text-muted-foreground"> · {detail}</span>}
          </h2>
          {hasSubtitle && (
            <p className="truncate text-sm">
              {href ? (
                <Link
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                  dir="auto"
                >
                  <span className="me-1.5 text-muted-foreground tabular-nums">{issueKey}</span>
                  <span className="group-hover:underline">{run.issueTitle}</span>
                </Link>
              ) : (
                run.scheduleName && (
                  <span className="text-muted-foreground">
                    {t('scheduleRun', { name: run.scheduleName })}
                  </span>
                )
              )}
            </p>
          )}
        </div>
        <span className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('copyLink')}
            onClick={() => void copyLink()}
          >
            <Link2 />
          </Button>
          {href && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href} target="_blank" rel="noopener noreferrer">
                {t('openWorkItem')}
                <ArrowUpRight />
              </Link>
            </Button>
          )}
        </span>
      </div>
    </header>
  );
}
