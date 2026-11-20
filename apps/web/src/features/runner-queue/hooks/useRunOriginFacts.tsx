import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import RunnerQueueRunLink from '../components/RunnerQueueRunLink';
import RunnerQueueRunPerson from '../components/RunnerQueueRunPerson';
import type { RunFact } from '../components/RunnerQueueRunFactList';

// Where the run comes from: whom it works for, who started it, the run it came from and the
// first run of its chain.
export function useRunOriginFacts(run: RunnerQueueRun, listPath: string): RunFact[] {
  const t = useTranslations('issue.agentRuns');
  const link = (target: { id: number; projectRef: string }, label: ReactNode) => (
    <RunnerQueueRunLink target={target} projectRef={run.projectRef} listPath={listPath}>
      {label}
    </RunnerQueueRunLink>
  );
  const { initiator, startedBy, parentRun, rootRun } = run;
  // With no person, the run is the project's work: its own schedule's, or else that of the
  // first run of its chain when that run has no person either. A chain a person started
  // turns into the project's work at a schedule's run, which this run does not name.
  const projectRoot = !run.scheduleName && rootRun && !rootRun.initiator ? rootRun : null;
  const scheduleName = projectRoot ? projectRoot.scheduleName : run.scheduleName;
  const projectWork = scheduleName ? t('scheduleRun', { name: scheduleName }) : t('projectWork');
  let forWhom: ReactNode = projectWork;
  if (initiator) {
    forWhom = (
      <RunnerQueueRunPerson name={initiator.name} image={initiator.image} label={initiator.name} />
    );
  } else if (projectRoot) {
    forWhom = link(projectRoot, projectWork);
  }
  const facts: RunFact[] = [[t('facts.initiator'), forWhom]];
  if (startedBy) {
    const { name, image, agentUsername } = startedBy;
    facts.push([
      t('facts.startedBy'),
      agentUsername ? (
        <RunnerQueueRunPerson name={agentUsername} label={`@${agentUsername}`} />
      ) : (
        <RunnerQueueRunPerson name={name} image={image} label={name} />
      ),
    ]);
  }
  if (parentRun) facts.push([t('facts.fromRun'), link(parentRun, `#${parentRun.id}`)]);
  if (rootRun && rootRun.id !== parentRun?.id) {
    const label = rootRun.initiator
      ? `#${rootRun.id} · ${rootRun.initiator.name}`
      : `#${rootRun.id}`;
    facts.push([t('facts.firstRun'), link(rootRun, label)]);
  }
  return facts;
}
