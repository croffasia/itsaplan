import type { ReactNode } from 'react';
import Link from 'next/link';
import { runPath } from '../utils/runPath';
import RunnerQueueLink from './RunnerQueueLink';

const CLASS_NAME = 'underline-offset-2 hover:underline';

// A run of the same project opens in the list this one was opened from, a run of another
// project in that project's list, which asks again whether the reader may open it.
export default function RunnerQueueRunLink({
  target,
  projectRef,
  listPath,
  children,
}: {
  target: { id: number; projectRef: string };
  projectRef: string;
  listPath?: string;
  children: ReactNode;
}) {
  if (target.projectRef !== projectRef) {
    return (
      <Link href={runPath(target)} className={CLASS_NAME}>
        {children}
      </Link>
    );
  }
  return (
    <RunnerQueueLink runId={target.id} href={runPath(target, listPath)} className={CLASS_NAME}>
      {children}
    </RunnerQueueLink>
  );
}
