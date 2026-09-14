'use client';

import { Area, AreaChart, XAxis } from 'recharts';
import type { AgentFleetSummary } from '@/lib/api';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const CHART_CONFIG = {
  runs: { label: 'Runs', color: 'var(--primary)' },
} satisfies ChartConfig;

function formatHour(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function AgentsRunChart({ summary }: { summary: AgentFleetSummary }) {
  const chartData = summary.hourlyRuns.map((item) => ({
    ...item,
    label: formatHour(item.hour, summary.timezone),
  }));

  return (
    <div className="flex min-h-72 flex-col px-5 py-5 sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Runs · last 24 hours
        </p>
        <p className="font-mono text-[10px] font-medium tracking-[0.12em] text-foreground uppercase">
          Peak {summary.peak.runs}/h · {formatHour(summary.peak.hour, summary.timezone)}
        </p>
      </div>

      <ChartContainer
        config={CHART_CONFIG}
        className="mt-4 h-48 w-full"
        initialDimension={{ width: 640, height: 192 }}
      >
        <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="agentRunsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-runs)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-runs)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            type="monotone"
            dataKey="runs"
            stroke="var(--color-runs)"
            strokeWidth={2.5}
            fill="url(#agentRunsFill)"
            activeDot={{ r: 4, fill: 'var(--color-runs)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-wide text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-2 bg-primary" /> Runs / hour
          </span>
          <span>Rolling 24h</span>
        </div>
        <span>Auto-refresh · 30s</span>
      </div>
    </div>
  );
}
