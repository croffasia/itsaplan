import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useIssueAgentRunsQuery } from '@/services/issues.service';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import AgentRunItem from '@/components/common/agent-runs/AgentRunItem';

export default function IssueAgentRunsPanel({
  issueId,
  canRead,
}: {
  issueId: number;
  canRead: boolean;
}) {
  const t = useTranslations('issue.agentRuns');
  const query = useIssueAgentRunsQuery(issueId, canRead);
  useLiveRefresh({
    scope: revScope.issue(issueId),
    targets: [qk.issueAgentRuns(issueId)],
    enabled: canRead,
  });
  useLiveRefresh({
    scope: revScope.runnerQueue,
    targets: [qk.issueAgentRuns(issueId)],
    enabled: canRead,
  });
  if (!canRead) return null;
  const runs = query.isError ? [] : (query.data?.pages.flatMap((page) => page.items) ?? []);
  return (
    <section>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('refresh')}
        </Button>
      </div>
      <div>
        {query.isLoading && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
        {query.isError && (
          <p role="alert" className="text-xs text-destructive">
            {t('loadError')}
          </p>
        )}
        {query.isSuccess && runs.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('empty')}</p>
        )}
        {runs.map((run) => (
          <AgentRunItem key={run.id} issueId={issueId} run={run} />
        ))}
        {!query.isError && query.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t('loadMore')}
          </Button>
        )}
      </div>
    </section>
  );
}
