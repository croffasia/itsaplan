import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useIssueAgentRunsQuery } from '@/services/issues.service';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import IssueSectionHeading from './IssueSectionHeading';
import IssueAgentRunItem from './IssueAgentRunItem';

export default function IssueAgentRunsPanel({
  issueId,
  canRead,
}: {
  issueId: number;
  canRead: boolean;
}) {
  const t = useTranslations('issue.agentRuns');
  const { open, toggle } = usePersistedOpen('issue-agent-runs-open');
  const query = useIssueAgentRunsQuery(issueId, canRead);
  useLiveRefresh({
    scope: revScope.issue(issueId),
    targets: [qk.issueAgentRuns(issueId)],
    enabled: canRead,
  });
  if (!canRead) return null;
  const runs = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="mt-6 border-t pt-5">
      <div className="flex h-7 items-center justify-between gap-2">
        <IssueSectionHeading label={t('title')} open={open} onToggle={toggle} />
        {open && (
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('refresh')}
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3">
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
            <IssueAgentRunItem key={run.id} issueId={issueId} run={run} />
          ))}
          {query.hasNextPage && (
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
      )}
    </section>
  );
}
