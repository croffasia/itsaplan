'use client';

import { useTranslations } from 'next-intl';
import { useTeamQuery } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import TeamGitConnections from './TeamGitConnections';

export default function TeamGitSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.integrations');
  const { data: team, isPending } = useTeamQuery(teamId);
  return (
    <SectionPageView title="Git" description={null} wide>
      {isPending ? (
        <ListSkeleton rows={2} rowClassName="h-16" />
      ) : team?.role === 'owner' || team?.role === 'manager' ? (
        <TeamGitConnections teamId={teamId} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('noAccess')}</p>
      )}
    </SectionPageView>
  );
}
