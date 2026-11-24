import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { documentPath, issuePath, splitProjectRef } from '@/utils/paths';
import Avatar from '@/components/common/Avatar';
import { runIssueKey } from '../utils/runIssueKey';
import { waitsForRunner } from '../utils/waitsForRunner';
import RunnerQueueKindBadge from '../components/RunnerQueueKindBadge';
import RunnerQueueRunActor from '../components/RunnerQueueRunActor';
import type { RunFact } from '../types/runFact';
import RunnerQueueStateIcon from '../components/RunnerQueueStateIcon';

// What the run is: its state and who stopped it, its agent, what set it off, what it works on,
// how it reaches the agent, and its number.
export function useRunFacts(run: RunnerQueueRun): RunFact[] {
  const t = useTranslations('issue.agentRuns');
  const tDocuments = useTranslations('documents');
  const issueKey = runIssueKey(run);
  const facts: RunFact[] = [
    [
      'status',
      <>
        <RunnerQueueStateIcon run={run} className="size-3.5" />
        {waitsForRunner(run) ? t('waitingForRunner') : t(run.executionState)}
      </>,
    ],
  ];
  if (run.canceledBy) {
    facts.push(['canceledBy', <RunnerQueueRunActor key="canceledBy" actor={run.canceledBy} />]);
  }
  facts.push(
    [
      'agent',
      <>
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={run.username} />
          <span className="min-w-0 break-all">@{run.username}</span>
        </span>
        <RunnerQueueKindBadge kind={run.kind} />
      </>,
    ],
    ['trigger', t(`triggers.${run.trigger}`)],
  );
  if (issueKey && run.sequenceNumber != null) {
    facts.push([
      'workItem',
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
  } else if (run.document) {
    facts.push([
      'document',
      <Link
        key="document"
        href={documentPath(run.projectRef, run.document.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {run.document.title.trim() || tDocuments('untitled')}
      </Link>,
    ]);
  } else {
    if (run.scheduleName) facts.push(['schedule', run.scheduleName]);
    facts.push(['project', splitProjectRef(run.projectRef).key]);
  }
  if (run.runnerState) {
    facts.push([
      run.runnerState === 'push' ? 'delivery' : 'runner',
      t(`connection.${run.runnerState}`),
    ]);
  }
  facts.push([
    'run',
    <span key="run" className="tabular-nums">
      #{run.id}
    </span>,
  ]);
  return facts;
}
