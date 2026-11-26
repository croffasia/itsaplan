'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTeamQuery } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import TeamGitConnections from './TeamGitConnections';
import TeamGitProviderConnectDialog from './TeamGitProviderConnectDialog';

export default function TeamGitSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.integrations');
  const tGit = useTranslations('settings.git');
  const { data: team, isPending } = useTeamQuery(teamId);
  const [connecting, setConnecting] = useState(false);
  const runsTeam = team?.role === 'owner' || team?.role === 'manager';

  let content = <p className="text-sm text-muted-foreground">{t('noAccess')}</p>;
  if (isPending) content = <ListSkeleton rows={2} rowClassName="h-12" />;
  else if (runsTeam) content = <TeamGitConnections teamId={teamId} />;

  return (
    <SectionPageView
      title="Git"
      description={tGit('nativeDescription')}
      actions={
        runsTeam && (
          <Button aria-label={tGit('nativeConnectHostTitle')} onClick={() => setConnecting(true)}>
            {tGit('nativeConnect')}
          </Button>
        )
      }
    >
      {content}
      {runsTeam && (
        <TeamGitProviderConnectDialog
          teamId={teamId}
          open={connecting}
          onOpenChange={setConnecting}
        />
      )}
    </SectionPageView>
  );
}
