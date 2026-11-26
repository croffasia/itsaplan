'use client';

import { useTranslations } from 'next-intl';
import GitHostMark from '@/components/common/git/GitHostMark';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useTeamGitProviderConnectionsQuery } from '@/services/gitConnections.service';
import { GIT_CONNECTION_PROVIDERS } from '@/utils/gitProviderConfig';
import TeamGitConnectionRow from './TeamGitConnectionRow';

export default function TeamGitConnections({ teamId }: { teamId: number }) {
  const t = useTranslations('settings.git');
  const { data: connections, isPending } = useTeamGitProviderConnectionsQuery(teamId);

  if (isPending) return <ListSkeleton rows={2} rowClassName="h-12" />;
  if (!connections) return null;
  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/50 px-6 py-14 text-center">
        <div className="flex gap-3.5 text-muted-foreground">
          {GIT_CONNECTION_PROVIDERS.map((provider) => (
            <GitHostMark key={provider} host={provider} className="size-5" />
          ))}
        </div>
        <p className="max-w-sm text-sm text-balance text-muted-foreground">{t('nativeEmpty')}</p>
      </div>
    );
  }
  return (
    <div className="divide-y">
      {connections.map((connection) => (
        <TeamGitConnectionRow key={connection.id} teamId={teamId} connection={connection} />
      ))}
    </div>
  );
}
