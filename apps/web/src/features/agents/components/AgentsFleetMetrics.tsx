import type { AgentFleetSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: value >= 10_000 ? 'compact' : 'standard' }).format(
    value,
  );
}

function formatDuration(value: number | null): string {
  if (value == null) return 'No completed runs';
  if (value < 1000) return `p95 ${value}ms`;
  if (value < 60_000) return `p95 ${(value / 1000).toFixed(1)}s`;
  return `p95 ${Math.round(value / 60_000)}m`;
}

function formatTrend(value: number | null): string {
  if (value == null) return 'No previous activity';
  const arrow = value >= 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(value)}% vs previous`;
}

export default function AgentsFleetMetrics({ summary }: { summary: AgentFleetSummary }) {
  const trend = summary.runTrendPercent;

  return (
    <div className="px-5 py-6 sm:px-7 lg:border-r">
      <div className="grid grid-cols-3 divide-x">
        <div className="pr-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />
            Live
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
            {summary.status.live}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">running now</p>
        </div>
        <div className="px-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-muted-foreground/60" />
            Idle
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
            {summary.status.idle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">available / standby</p>
        </div>
        <div className="pl-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-500" />
            Warn
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
            {summary.status.warning}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">need attention</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-5">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Runs · 24 hours
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatNumber(summary.runs24h)}
          </p>
          <p
            className={cn(
              'mt-1 text-[11px] tabular-nums',
              trend != null && trend > 0 && 'text-emerald-600 dark:text-emerald-400',
              trend != null && trend < 0 && 'text-destructive',
              (trend == null || trend === 0) && 'text-muted-foreground',
            )}
          >
            {formatTrend(trend)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Schedules · active
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{summary.schedules.active}</p>
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {summary.schedules.total} configured
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Success · 7 days
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {summary.successRate7d == null ? '—' : `${summary.successRate7d}%`}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {formatDuration(summary.p95DurationMs7d)}
          </p>
        </div>
      </div>
    </div>
  );
}
