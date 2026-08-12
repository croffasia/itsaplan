import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentWorkloadQuery } from '../../services/analytics.service';

// Per-agent workload: how many open issues each agent is currently delegated and its
// lifetime run outcomes (success over total). Rows are ordered by delegated load. No
// per-widget config; it always shows every agent in the project.
export default function AgentWorkloadWidget({ projectKey }: { projectKey: string }) {
  const t = useTranslations('dashboards.agentWorkload');
  const { data, isLoading } = useAgentWorkloadQuery(projectKey);
  // The API types the agent kind as a plain string; one the messages do not carry
  // is shown as it came.
  const kindLabel = (kind: string) =>
    kind === 'external' || kind === 'internal' ? t(`kind.${kind}`) : kind;
  const items = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="pb-1.5 font-medium">{t('agent')}</th>
          <th className="pb-1.5 text-right font-medium">{t('delegated')}</th>
          <th className="pb-1.5 text-right font-medium">{t('runs')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {items.map((a) => (
          <tr key={a.agentId}>
            <td className="min-w-0 py-1.5">
              <span className="block truncate">{a.agentName}</span>
              <span className="text-xs text-muted-foreground">{kindLabel(a.kind)}</span>
            </td>
            <td className="py-1.5 text-right tabular-nums">{a.delegatedOpen}</td>
            <td className="py-1.5 text-right tabular-nums">
              <span>
                {a.runsSuccess}/{a.runsTotal}
              </span>
              {a.runsFailed > 0 && (
                <span className="ml-1 text-xs text-destructive">
                  {t('failed', { count: a.runsFailed })}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
