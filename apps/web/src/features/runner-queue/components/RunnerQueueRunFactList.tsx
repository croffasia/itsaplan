import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { RunFact } from '../types/runFact';

export default function RunnerQueueRunFactList({
  facts,
  className,
}: {
  facts: RunFact[];
  className?: string;
}) {
  const t = useTranslations('issue.agentRuns.facts');
  return (
    <dl
      className={cn(
        'grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-2.5',
        className,
      )}
    >
      {facts.map(([key, value]) => (
        <Fragment key={key}>
          <dt className="text-muted-foreground">{t(key)}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words">
            {value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
