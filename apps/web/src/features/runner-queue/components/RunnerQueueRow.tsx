import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { issuePath } from '@/utils/paths';
import AgentRunItem from '@/components/common/agent-runs/AgentRunItem';

export default function RunnerQueueRow({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  return (
    <section className="rounded-md border px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {run.sequenceNumber != null ? (
          <Link
            className="font-medium text-foreground hover:underline"
            href={issuePath(run.projectRef, run.sequenceNumber)}
          >
            {run.projectRef} · {run.issueTitle}
          </Link>
        ) : (
          <span>{run.projectRef}</span>
        )}
        <span>{t(`presence.${run.runnerState}`)}</span>
      </div>
      <AgentRunItem issueId={run.issueId} run={run} defaultOpen />
    </section>
  );
}
