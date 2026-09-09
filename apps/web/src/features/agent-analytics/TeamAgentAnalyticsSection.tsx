'use client';

import { useTranslations } from 'next-intl';
import { useTeamQuery } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import AgentAnalyticsView from './components/AgentAnalyticsView';
import RetentionHint from './components/RetentionHint';

// The team's agent dashboard: every agent it owns, across every project they work in.
// It follows the rank in the team rather than a project role, so it is the owner's and
// the managers' — the same standing that governs the roles section.
export default function TeamAgentAnalyticsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('agentAnalytics');
  const tCommon = useTranslations('common');
  const { data: team } = useTeamQuery(teamId);
  const runsTeam = team?.role === 'owner' || team?.role === 'manager';

  return (
    <SectionPageView
      title={t('title')}
      description={
        <>
          {t('teamDescription')} <RetentionHint />
        </>
      }
      wide
    >
      {!team ? (
        <Skeleton className="h-72 w-full" />
      ) : !runsTeam ? (
        <p className="text-sm text-muted-foreground">{tCommon('noSectionAccess')}</p>
      ) : (
        <AgentAnalyticsView scope={{ teamId }} />
      )}
    </SectionPageView>
  );
}
