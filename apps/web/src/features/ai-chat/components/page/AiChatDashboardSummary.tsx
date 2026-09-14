import type { ChatDashboardSummary, HermesChatAgent } from '@/lib/api';
import { AiChatDashboardMetrics } from './AiChatDashboardMetrics';
import { AiChatMessageChart } from './AiChatMessageChart';

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(value))
    .replace(',', ' ·')
    .toUpperCase();
}

export function AiChatDashboardSummary({
  summary,
  agents,
}: {
  summary: ChatDashboardSummary;
  agents: HermesChatAgent[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-t-2 border-t-primary bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-7">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          <span className="size-2 rounded-full bg-emerald-500" />
          Comms · live
        </p>
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {formatTimestamp(summary.generatedAt)}
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <AiChatDashboardMetrics summary={summary} agents={agents} />
        <AiChatMessageChart summary={summary} />
      </div>
    </section>
  );
}
