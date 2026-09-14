import type { ChatDashboardSummary, HermesChatAgent } from '@/lib/api';

function formatDuration(value: number | null): string {
  if (value == null) return 'No replies yet';
  if (value < 1000) return `${value}ms`;
  if (value < 60_000) return `${Math.round(value / 1000)}s`;
  return `${Math.round(value / 60_000)}m`;
}

export function AiChatDashboardMetrics({
  summary,
  agents,
}: {
  summary: ChatDashboardSummary;
  agents: HermesChatAgent[];
}) {
  const ready = agents.filter((agent) => agent.status === 'ready').length;
  const offline = agents.length - ready;
  const primaryMetrics = [
    { label: 'Threads', value: summary.threads, detail: 'your conversations', className: 'pr-4' },
    {
      label: 'Awaiting you',
      value: summary.awaitingReply,
      detail: 'assistant replied last',
      className: 'px-4',
      dot: true,
    },
    {
      label: 'Messages · 24h',
      value: summary.messages24h,
      detail: 'handled recently',
      className: 'pl-4',
    },
  ];
  const secondaryMetrics = [
    { label: 'Ready', value: String(ready), detail: 'Hermes API' },
    { label: 'Offline', value: String(offline), detail: 'needs attention' },
    {
      label: 'Median reply · 7d',
      value: formatDuration(summary.medianReplyMs7d),
      detail: 'user to assistant',
    },
  ];

  return (
    <div className="px-5 py-6 sm:px-7 lg:border-r">
      <div className="grid grid-cols-3 divide-x">
        {primaryMetrics.map((metric) => (
          <div key={metric.label} className={metric.className}>
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {metric.dot && (
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-500" />
              )}
              {metric.label}
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-5">
        {secondaryMetrics.map((metric) => (
          <div key={metric.label}>
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {metric.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{metric.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
