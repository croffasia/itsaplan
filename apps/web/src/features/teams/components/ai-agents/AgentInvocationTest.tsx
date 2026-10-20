import { CircleCheck, CircleX, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InvocationTestResult } from '@/lib/api/endpoints/agents';
import { useTestInvocation } from '@/services/aiAgents.service';
import { Button } from '@/components/ui/button';
import { useAgentSection } from '../../context/agentSection';

// Sends a signed ping to the saved URL and shows how the endpoint answered: whether it
// is reachable and whether it accepts the signature.
export default function AgentInvocationTest({ agentId }: { agentId: number }) {
  const t = useTranslations('teams.agents');
  const { teamId } = useAgentSection();
  const test = useTestInvocation(teamId);
  const result = test.data;

  function summary(r: InvocationTestResult): string {
    if (r.ok) return t('invocationTestOk', { status: r.status ?? 0, ms: r.durationMs });
    if (r.timedOut) return t('invocationTestTimeout');
    if (r.status !== null) return t('invocationTestRefused', { status: r.status });
    return t('invocationTestUnreachable');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-sm font-medium">{t('invocationTest')}</span>
          <span className="block text-xs text-muted-foreground">{t('invocationTestHint')}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={test.isPending}
          onClick={() => test.mutate(agentId)}
        >
          <Send className="size-3.5" />
          {test.isPending ? t('invocationTestSending') : t('invocationTestSend')}
        </Button>
      </div>

      {result && !test.isPending && (
        <div className="space-y-1.5 rounded-md bg-muted/50 px-3 py-2" aria-live="polite">
          <p className="flex items-center gap-1.5 text-xs">
            {result.ok ? (
              <CircleCheck className="size-3.5 shrink-0 text-emerald-500" />
            ) : (
              <CircleX className="size-3.5 shrink-0 text-destructive" />
            )}
            <span className="font-medium">{summary(result)}</span>
            {/* The transport's own words, for the cases the summary cannot name. */}
            {!result.ok && result.status === null && !result.timedOut && result.error && (
              <span className="min-w-0 truncate text-muted-foreground" dir="ltr">
                {result.error}
              </span>
            )}
          </p>
          {result.responseBody && (
            <pre
              dir="ltr"
              className="max-h-32 overflow-auto rounded bg-background/60 px-2 py-1.5 text-start font-mono text-xs whitespace-pre-wrap text-muted-foreground"
            >
              {result.responseBody}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
