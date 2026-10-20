'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ROW_GRID =
  'grid grid-cols-[minmax(15rem,20rem)_minmax(15rem,1fr)_14rem] items-center gap-4 px-2';

// Where the limit sits on the track, which runs on to 160% of it.
const LIMIT_AT = '62.5%';

const SPENT = ['45%', '58%', '30%', '66%', '20%'];

// The budgets of the people, the teams and the projects, each with how much of it is spent.
export default function WorkspacePreviewBudgetList() {
  const t = useTranslations('sections.previews.agentBudgets');

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t('list')}</h2>
      <div className="overflow-hidden">
        <div className="min-w-[50rem]">
          <div className={cn(ROW_GRID, 'border-b pb-2 text-xs text-muted-foreground')}>
            <span>{t('columns.budget')}</span>
            <span dir="ltr" className="relative h-4">
              <span className="absolute left-0">0%</span>
              <span
                className="absolute -translate-x-1/2 font-medium text-destructive"
                style={{ left: LIMIT_AT }}
              >
                100%
              </span>
            </span>
            <span className="text-end">{t('columns.spent')}</span>
          </div>
          {SPENT.map((spent, index) => (
            <div key={spent} className={cn(ROW_GRID, 'border-b py-2.5')}>
              <div className="flex min-w-0 items-center gap-2">
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5" style={{ width: `${70 - index * 8}%` }} />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              </div>
              <div dir="ltr" className="relative h-[22px]">
                <div className="absolute inset-x-0 inset-y-[7px] rounded-full bg-muted" />
                <Skeleton
                  className="absolute inset-y-[7px] left-0 rounded-full bg-muted-foreground/25"
                  style={{ width: spent }}
                />
                <div
                  className="absolute inset-y-0.5 -ml-px w-0.5 rounded-full bg-destructive/50"
                  style={{ left: LIMIT_AT }}
                />
              </div>
              <Skeleton className="ms-auto h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
