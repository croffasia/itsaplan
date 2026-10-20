'use client';

import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import { Skeleton } from '@/components/ui/skeleton';
import WorkspacePreviewBlock from './WorkspacePreviewBlock';

const DAYS = [
  20, 35, 15, 40, 55, 30, 10, 45, 60, 35, 25, 50, 70, 40, 20, 55, 65, 30, 45, 80, 50, 35, 60, 75,
  40, 25, 55, 70, 45, 60,
];

const SUMMARY = ['teams', 'projects', 'people', 'agents'] as const;
const TOTALS = ['openIssues', 'storage'] as const;

export default function WorkspaceDashboardPreview() {
  const t = useTranslations('sections.previews.dashboard');

  return (
    <SectionPageView title={t('title')} description={t('description')} wide>
      <SectionPreview>
        <div className="flex flex-col gap-10">
          <div className="flex flex-wrap gap-y-4 rounded-xl bg-muted/50 py-4">
            <div className="grid min-w-0 flex-[4_1_440px] grid-cols-4 gap-4 px-6">
              {SUMMARY.map((key) => (
                <div key={key} className="min-w-0 space-y-1.5">
                  <Skeleton className="h-8 w-12" />
                  <p className="truncate text-sm text-muted-foreground">{t(`summary.${key}`)}</p>
                </div>
              ))}
            </div>
            <div className="grid min-w-0 flex-[2_1_240px] grid-cols-2 gap-4 border-s border-border/60 px-6">
              {TOTALS.map((key) => (
                <div key={key} className="min-w-0 space-y-1.5">
                  <Skeleton className="h-8 w-16" />
                  <p className="truncate text-sm text-muted-foreground">{t(`summary.${key}`)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
            <WorkspacePreviewBlock
              title={t('blocks.agents')}
              className="lg:col-span-7"
              bars={DAYS}
              rows={3}
            />
            <WorkspacePreviewBlock
              title={t('blocks.schedules')}
              className="lg:col-span-5"
              rows={5}
            />
            <WorkspacePreviewBlock
              title={t('blocks.time')}
              className="lg:col-span-7"
              bars={[...DAYS].reverse()}
              rows={3}
            />
            <WorkspacePreviewBlock
              title={t('blocks.flow')}
              className="lg:col-span-5"
              bars={[60, 85, 45, 70, 55]}
            />
            <WorkspacePreviewBlock
              title={t('blocks.projects')}
              className="lg:col-span-7"
              figures={false}
              rows={5}
            />
            <WorkspacePreviewBlock
              title={t('blocks.teams')}
              className="lg:col-span-5"
              figures={false}
              rows={5}
            />
          </div>
        </div>
      </SectionPreview>
    </SectionPageView>
  );
}
