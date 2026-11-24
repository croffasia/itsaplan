'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import SettingsWorkflowsPreviewStatus, {
  type SettingsWorkflowsPreviewState,
} from './SettingsWorkflowsPreviewStatus';

const LABEL = 'px-2 py-1 text-xs font-medium text-muted-foreground';

const HISTORY: { state: SettingsWorkflowsPreviewState; title: string }[] = [
  { state: 'done', title: '75%' },
  { state: 'done', title: '60%' },
  { state: 'failed', title: '70%' },
  { state: 'done', title: '85%' },
  { state: 'done', title: '55%' },
  { state: 'done', title: '65%' },
];

// The runs of the workflow: the one under way, open, and the ones before it.
export default function SettingsWorkflowsPreviewRunList() {
  const t = useTranslations('sections.previews.workflows');
  const row = (state: SettingsWorkflowsPreviewState, title: string, open = false) => (
    <li
      key={title}
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', open && 'bg-muted')}
    >
      <SettingsWorkflowsPreviewStatus state={state} />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3" style={{ width: title }} />
      </span>
      <Skeleton className="h-2.5 w-12 shrink-0" />
    </li>
  );

  return (
    <div className="overflow-hidden bg-muted/30 p-2">
      <p className={LABEL}>{t('runningNow')}</p>
      <ul className="mt-1">{row('running', '80%', true)}</ul>
      <p className={cn(LABEL, 'mt-3')}>{t('history')}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {HISTORY.map(({ state, title }) => row(state, title))}
      </ul>
    </div>
  );
}
