'use client';

import { Clock, Kanban, Undo2, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import SettingsWorkflowsPreviewEdges from './SettingsWorkflowsPreviewEdges';
import SettingsWorkflowsPreviewStep from './SettingsWorkflowsPreviewStep';

const CAPTION =
  'absolute top-0 flex items-center gap-3 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border';
const SHARED = 'top-[120px] h-[76px] w-[196px]';

const WAYS = [
  { top: 28, Icon: Kanban, label: 'bg-blue-500', title: '70%', step: '75%', done: true },
  { top: 120, Icon: Webhook, label: 'bg-green-500', title: '85%', step: '60%' },
  { top: 212, Icon: Clock, title: '60%', step: '70%' },
];

// A workflow with three ways in: two issue events and a schedule. Each leads through a step of
// its own into the steps they share; a run is under way through the first of them, and the
// second step has sent the work back once. The last step runs past the box and fades; the
// canvas clips what passes its edge.
export default function SettingsWorkflowsPreviewStage() {
  const t = useTranslations('sections.previews.workflows');
  const tAgents = useTranslations('teams.agents');

  return (
    <div dir="ltr" className="w-full max-w-[1136px]">
      <div className="relative h-[288px] w-[1136px]">
        <SettingsWorkflowsPreviewEdges />

        <p className={cn(CAPTION, 'start-0 w-[536px]')}>{tAgents('triggers')}</p>
        {WAYS.map(({ top, Icon, label, title, step, done }, index) => (
          <div key={top}>
            <div
              className={cn(
                'absolute start-0 h-[76px] w-[236px] rounded-[10px] border bg-card p-3',
                index === 0 && 'border-ring',
              )}
              style={{ top }}
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-16" />
                {label && (
                  <span className="flex items-center gap-1.5">
                    <i className={cn('size-[7px] rounded-full', label)} />
                    <Skeleton className="h-2.5 w-10" />
                  </span>
                )}
              </div>
              <Skeleton className="mt-3.5 h-3.5" style={{ width: title }} />
            </div>
            <span
              className="absolute start-[297px] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-muted-foreground"
              style={{ top: top + 38 }}
            >
              <Icon className="size-3" />
              <Skeleton className="h-2 w-12" />
            </span>
            <SettingsWorkflowsPreviewStep
              name={step}
              state={done ? 'done' : undefined}
              className="start-[360px] h-14 w-[176px]"
              style={{ top: top + 10 }}
            />
          </div>
        ))}

        <p className={cn(CAPTION, 'start-[576px] w-[560px]')}>{t('steps')}</p>
        <SettingsWorkflowsPreviewStep
          name="70%"
          state="done"
          note
          className={cn(SHARED, 'start-[576px]')}
        />
        <SettingsWorkflowsPreviewStep
          name="60%"
          state="running"
          note
          className={cn(SHARED, 'start-[812px] border-ring')}
        />
        <SettingsWorkflowsPreviewStep
          name="65%"
          note
          className={cn(
            SHARED,
            'start-[1048px] [mask-image:linear-gradient(to_right,#000_50%,transparent)] opacity-50',
          )}
        />
        <span className="absolute start-[799px] top-[232px] flex h-6 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium text-muted-foreground">
          <Undo2 className="size-3 text-warning" />
          {t('sendBack')}
        </span>
      </div>
    </div>
  );
}
