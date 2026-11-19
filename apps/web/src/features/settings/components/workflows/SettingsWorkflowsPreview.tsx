'use client';

import { PanelBottom, PanelRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import PageHeader from '@/components/common/page/PageHeader';
import { SECTION_PREVIEW_CONTENT_CLASS } from '@/components/common/page/SectionPreview';
import SectionPreviewBanner from '@/components/common/page/SectionPreviewBanner';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { cn } from '@/lib/utils';
import SettingsWorkflowsPreviewRun from './SettingsWorkflowsPreviewRun';
import SettingsWorkflowsPreviewRunList from './SettingsWorkflowsPreviewRunList';
import SettingsWorkflowsPreviewRunStep from './SettingsWorkflowsPreviewRunStep';
import SettingsWorkflowsPreviewStage from './SettingsWorkflowsPreviewStage';

const DOTS = {
  backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
  backgroundSize: '16px 16px',
};

// The page fills the screen as the workflow editor does: under the header, a workflow on its
// canvas across the page, and the run history docked at the bottom, open on the run under way.
export default function SettingsWorkflowsPreview() {
  const text = useSettingsSectionText()('workflows');
  const t = useTranslations('sections.previews.workflows');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8">
        <PageHeader
          title={text.label}
          description={text.description}
          actions={<SectionPreviewBanner feature="workflows" />}
          className="mb-5"
        />
      </div>
      <div
        className={cn(SECTION_PREVIEW_CONTENT_CLASS, 'flex min-h-0 flex-1 flex-col')}
        aria-hidden
      >
        <div
          className="flex min-h-[320px] flex-1 items-center justify-center overflow-hidden bg-sidebar px-8"
          style={DOTS}
        >
          <SettingsWorkflowsPreviewStage />
        </div>
        <div className="flex min-h-[220px] flex-1 flex-col border-t bg-card">
          <div className="flex h-11 shrink-0 items-center gap-2 px-4 text-muted-foreground">
            <p className="me-auto text-sm font-semibold text-foreground">{t('runs')}</p>
            <span className="flex gap-0.5 rounded-md bg-muted p-0.5">
              <span className="grid h-[22px] w-6 place-items-center">
                <PanelRight className="size-3.5" />
              </span>
              <span className="grid h-[22px] w-6 place-items-center rounded-[4px] bg-card text-foreground">
                <PanelBottom className="size-3.5" />
              </span>
            </span>
            <X className="mx-[5px] size-3.5" />
          </div>
          <div className="grid min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] md:grid-cols-[minmax(0,352fr)_minmax(0,416fr)] xl:grid-cols-[minmax(0,352fr)_minmax(0,416fr)_minmax(0,672fr)]">
            <SettingsWorkflowsPreviewRunList />
            <SettingsWorkflowsPreviewRun />
            <SettingsWorkflowsPreviewRunStep />
          </div>
        </div>
      </div>
    </div>
  );
}
