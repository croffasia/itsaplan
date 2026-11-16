import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type RunFact = [label: string, value: ReactNode];

export default function RunnerQueueRunFactList({
  facts,
  className,
}: {
  facts: RunFact[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-2.5',
        className,
      )}
    >
      {facts.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words">
            {value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
