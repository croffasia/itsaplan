import type { ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { OnboardingSlideDef, OnboardingSlideId } from '../utils/slides';
import OnboardingAgentsArt from './art/OnboardingAgentsArt';
import OnboardingAnalyticsArt from './art/OnboardingAnalyticsArt';
import OnboardingAuditArt from './art/OnboardingAuditArt';
import OnboardingBudgetsArt from './art/OnboardingBudgetsArt';
import OnboardingCyclesArt from './art/OnboardingCyclesArt';
import OnboardingDashboardsArt from './art/OnboardingDashboardsArt';
import OnboardingDocumentsArt from './art/OnboardingDocumentsArt';
import OnboardingInitiativesArt from './art/OnboardingInitiativesArt';
import OnboardingNotesArt from './art/OnboardingNotesArt';
import OnboardingPortalArt from './art/OnboardingPortalArt';
import OnboardingSchedulesArt from './art/OnboardingSchedulesArt';
import OnboardingWorkflowsArt from './art/OnboardingWorkflowsArt';
import OnboardingWorkItemsArt from './art/OnboardingWorkItemsArt';

const ART: Record<OnboardingSlideId, ComponentType> = {
  dashboards: OnboardingDashboardsArt,
  workItems: OnboardingWorkItemsArt,
  initiatives: OnboardingInitiativesArt,
  cycles: OnboardingCyclesArt,
  documents: OnboardingDocumentsArt,
  notes: OnboardingNotesArt,
  agents: OnboardingAgentsArt,
  schedules: OnboardingSchedulesArt,
  workflows: OnboardingWorkflowsArt,
  portal: OnboardingPortalArt,
  budgets: OnboardingBudgetsArt,
  analytics: OnboardingAnalyticsArt,
  audit: OnboardingAuditArt,
};

// One slide: its picture over its name, title and text. A slide out of view is inert, so
// Tab never reaches the controls of a picture the reader cannot see.
export default function OnboardingSlide({
  slide,
  inert,
}: {
  slide: OnboardingSlideDef;
  inert: boolean;
}) {
  const t = useTranslations('onboarding');
  const tNav = useTranslations('nav');
  const tSections = useTranslations('sections');
  const Art = ART[slide.id];
  const name: Record<OnboardingSlideId, string> = {
    dashboards: tNav('dashboards'),
    workItems: tNav('workItems'),
    initiatives: tNav('initiatives'),
    cycles: tNav('cycles'),
    documents: tNav('documents'),
    notes: tNav('notes'),
    agents: tNav('aiAgents'),
    schedules: tSections('settings.schedules.label'),
    workflows: t('slides.workflows.name'),
    portal: t('slides.portal.name'),
    budgets: t('slides.budgets.name'),
    analytics: t('slides.analytics.name'),
    audit: t('slides.audit.name'),
  };

  return (
    <section inert={inert} className="w-full shrink-0 snap-start">
      <div dir="ltr" className={cn('@container relative aspect-[600/280] w-full', slide.tint)}>
        <Art />
      </div>
      <div className="flex flex-col gap-2 px-7 pt-5 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className={cn('size-2 rounded-full', slide.dot)} />
          {name[slide.id]}
          {slide.pro && (
            <span className="rounded-full bg-[#E9A52A] px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-[0.1em] text-neutral-900 dark:bg-[#F2B544]">
              PRO
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{t(`slides.${slide.id}.title`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`slides.${slide.id}.body`)}</p>
        {slide.pro && (
          <p className="text-[13px] font-medium text-[#8A6410] dark:text-[#F2B544]">
            {t('proNote')}
          </p>
        )}
      </div>
    </section>
  );
}
