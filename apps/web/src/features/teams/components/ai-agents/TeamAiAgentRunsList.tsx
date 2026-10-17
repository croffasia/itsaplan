import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useAgentRuns } from '@/services/aiAgents.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { revScope } from '@/utils/revScopes';
import { qk } from '@/services/queryKeys';
import { useAgentSection } from '../../context/agentSection';
import TeamAiAgentRunItem from './TeamAiAgentRunItem';

export default function TeamAiAgentRunsList({
  agentId,
  external,
}: {
  agentId: number;
  external: boolean;
}) {
  const t = useTranslations('teams.agents');
  const tCommon = useTranslations('common');
  const tRuns = useTranslations('issue.agentRuns');
  const teamId = useAgentSection().teamId;
  const query = useAgentRuns(teamId, agentId);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.agentRuns(teamId ?? 0, agentId)] });
  const runs = query.isError ? [] : (query.data?.pages.flatMap((p) => p.items) ?? []);
  if (query.isError) {
    return (
      <div className="space-y-2 p-4">
        <p role="alert" className="text-xs text-destructive">
          {tRuns('loadError')}
        </p>
        <Button variant="ghost" onClick={() => void query.refetch()}>
          {tRuns('refresh')}
        </Button>
      </div>
    );
  }

  if (query.isLoading) {
    return <ListSkeleton rows={4} className="p-4" rowClassName="h-12" />;
  }
  if (runs.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('noRuns')}</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="divide-y divide-border/50">
        {runs.map((r) => (
          <TeamAiAgentRunItem key={r.id} run={r} external={external} />
        ))}
      </div>
      <div className="p-4">
        {query.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? tCommon('loading') : t('loadMore')}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">{t('endOfHistory')}</p>
        )}
      </div>
    </div>
  );
}
