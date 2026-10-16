import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useIssueAgentRunTraceQuery } from '@/services/issues.service';
import IssueAgentRunBlock from './IssueAgentRunBlock';

export default function IssueAgentRunTrace({ issueId, runId }: { issueId: number; runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const query = useIssueAgentRunTraceQuery(issueId, runId);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{t('trace')}</p>
        <Button
          size="sm"
          variant="ghost"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('refresh')}
        </Button>
      </div>
      {query.isLoading && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {t('loadError')}
        </p>
      )}
      {query.isSuccess && query.data == null && (
        <p className="text-xs text-muted-foreground">{t('noTrace')}</p>
      )}
      {query.data?.spans.map((span) => (
        <details key={span.spanId} className="rounded-md border p-3">
          <summary className="cursor-pointer text-xs">
            <span dir="auto">{span.name}</span> · {span.type} · {span.status}
          </summary>
          <div className="mt-3 space-y-3">
            <IssueAgentRunBlock label={t('input')} value={span.input} />
            <IssueAgentRunBlock label={t('result')} value={span.output} />
            <IssueAgentRunBlock label={t('error')} value={span.error} />
            <IssueAgentRunBlock label={t('attributes')} value={span.attributes} />
          </div>
        </details>
      ))}
    </div>
  );
}
