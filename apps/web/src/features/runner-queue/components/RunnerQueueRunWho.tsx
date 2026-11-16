import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { issuePath, splitProjectRef } from '@/utils/paths';
import Avatar from '@/components/common/Avatar';
import { runIssueKey } from '../utils/runIssueKey';
import { waitsForRunner } from '../utils/waitsForRunner';
import RunnerQueueKindBadge from './RunnerQueueKindBadge';
import RunnerQueueRunFactList, { type RunFact } from './RunnerQueueRunFactList';
import RunnerQueueStateIcon from './RunnerQueueStateIcon';

// Who ran the run, on what, and how it reached the agent.
export default function RunnerQueueRunWho({
  run,
  className,
}: {
  run: RunnerQueueRun;
  className?: string;
}) {
  const t = useTranslations('issue.agentRuns');
  const issueKey = runIssueKey(run);
  const facts: RunFact[] = [
    [
      t('facts.status'),
      <>
        <RunnerQueueStateIcon run={run} className="size-3.5" />
        {waitsForRunner(run) ? t('waitingForRunner') : t(run.executionState)}
      </>,
    ],
    [
      t('facts.agent'),
      <>
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={run.username} />
          <span className="min-w-0 break-all">@{run.username}</span>
        </span>
        <RunnerQueueKindBadge kind={run.kind} />
      </>,
    ],
    [t('facts.trigger'), t(`triggers.${run.trigger}`)],
  ];
  if (issueKey && run.sequenceNumber != null) {
    facts.push([
      t('facts.workItem'),
      <Link
        key="issue"
        href={issuePath(run.projectRef, run.sequenceNumber)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {issueKey}
      </Link>,
    ]);
  } else {
    if (run.scheduleName) facts.push([t('facts.schedule'), run.scheduleName]);
    facts.push([t('facts.project'), splitProjectRef(run.projectRef).key]);
  }
  if (run.runnerState) {
    facts.push([
      run.runnerState === 'push' ? t('facts.delivery') : t('facts.runner'),
      t(`connection.${run.runnerState}`),
    ]);
  }
  return <RunnerQueueRunFactList facts={facts} className={className} />;
}
