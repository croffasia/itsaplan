import type { ReactNode } from 'react';
import Link from 'next/link';
import { runnerQueuePath } from '@/utils/paths';

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
  listPath: string;
  children: ReactNode;
}) {
  const list = target.projectRef === projectRef ? listPath : runnerQueuePath(target.projectRef);
  return (
    <Link href={`${list}/${target.id}`} className="underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
