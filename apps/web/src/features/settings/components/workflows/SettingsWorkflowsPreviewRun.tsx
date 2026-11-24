'use client';

import { CircleDot, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import SettingsWorkflowsPreviewStatus, {
  type SettingsWorkflowsPreviewState,
} from './SettingsWorkflowsPreviewStatus';

const FACTS = ['costSoFar', 'tokensSoFar', 'agentRuns'] as const;

const FIGURES = ['tokens', 'cost', 'took'] as const;

const STEPS: { state: SettingsWorkflowsPreviewState; name: string; open?: boolean }[] = [
  { state: 'done', name: '45%' },
  { state: 'done', name: '60%' },
  { state: 'done', name: '55%' },
  { state: 'back', name: '50%' },
  { state: 'done', name: '55%', open: true },
  { state: 'running', name: '50%' },
];

// The run under way: what started it, what it has spent so far and its steps, the step that
// answered the send back open.
export default function SettingsWorkflowsPreviewRun() {
  const t = useTranslations('sections.previews.workflows');

  return (
    <div className="hidden flex-col gap-4 overflow-hidden px-4 pt-3 pb-4 md:flex">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
          <LoaderCircle className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-4/5" />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 py-1.5 ps-2 pe-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <CircleDot className="size-3.5" />
        </span>
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <dl className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 px-4 py-3">
        {FACTS.map((fact) => (
          <div key={fact} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{t(fact)}</dt>
            <dd>
              <Skeleton className="mt-2 h-4 w-12" />
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1.5">
        <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="me-auto font-medium">{t('steps')}</span>
          {FIGURES.map((figure) => (
            <span key={figure} className="w-12 truncate text-end">
              {t(figure)}
            </span>
          ))}
        </p>
        <ul className="-mx-2 flex flex-col gap-0.5">
          {STEPS.map(({ state, name, open }, index) => (
            <li
              key={index}
              className={cn('flex h-[30px] items-center gap-2 rounded-md px-2', open && 'bg-muted')}
            >
              <SettingsWorkflowsPreviewStatus state={state} />
              <span className="min-w-0 flex-1">
                <Skeleton className="h-3" style={{ width: name }} />
              </span>
              {FIGURES.map((figure) => (
                <span key={figure} className="flex w-12 justify-end">
                  {state !== 'running' && <Skeleton className="h-2.5 w-8" />}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
