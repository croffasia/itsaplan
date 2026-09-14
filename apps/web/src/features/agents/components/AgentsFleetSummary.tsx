import type { AgentFleetSummary } from '@/lib/api';
import AgentsFleetMetrics from './AgentsFleetMetrics';
import AgentsRunChart from './AgentsRunChart';

function formatTimestamp(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
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

export default function AgentsFleetSummary({ summary }: { summary: AgentFleetSummary }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-t-2 border-t-primary bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          <span className="size-2 rounded-full bg-emerald-500" />
          Agent status · live
        </p>
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {formatTimestamp(summary.generatedAt, summary.timezone)} · {summary.timezone}
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <AgentsFleetMetrics summary={summary} />
        <AgentsRunChart summary={summary} />
      </div>
    </section>
  );
}
