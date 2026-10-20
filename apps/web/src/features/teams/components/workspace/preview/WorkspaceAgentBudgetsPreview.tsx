'use client';

import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import { Skeleton } from '@/components/ui/skeleton';
import WorkspacePreviewBudgetList from './WorkspacePreviewBudgetList';
import WorkspacePreviewSpendChart from './WorkspacePreviewSpendChart';

const FIGURES = ['spent', 'limit', 'left', 'forecast'] as const;

export default function WorkspaceAgentBudgetsPreview() {
  const t = useTranslations('sections.previews.agentBudgets');

  return (
    <SectionPageView title={t('title')} description={t('description')} wide>
      <SectionPreview>
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <header className="flex flex-wrap items-baseline gap-x-3 border-b border-border pb-3">
              <h2 className="text-base font-semibold">{t('workspace')}</h2>
              <Skeleton className="h-3 w-40" />
            </header>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6">
              {FIGURES.map((figure) => (
                <div key={figure} className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">{t(`figures.${figure}`)}</span>
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>
            <WorkspacePreviewSpendChart />
          </section>
          <WorkspacePreviewBudgetList />
        </div>
      </SectionPreview>
    </SectionPageView>
  );
}
