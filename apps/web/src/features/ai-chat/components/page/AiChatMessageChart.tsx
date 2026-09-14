'use client';

import { Area, AreaChart, XAxis } from 'recharts';
import type { ChatDashboardSummary } from '@/lib/api';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const CHART_CONFIG = {
  messages: { label: 'Messages', color: 'var(--primary)' },
} satisfies ChartConfig;

function formatHour(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function AiChatMessageChart({ summary }: { summary: ChatDashboardSummary }) {
  const data = summary.hourlyMessages.map((item) => ({
    ...item,
    label: formatHour(item.hour),
  }));

  return (
    <div className="flex min-h-64 flex-col px-5 py-5 sm:px-7">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Message volume · last 24 hours
        </p>
        <p className="font-mono text-[10px] font-medium tracking-[0.12em] uppercase">
          Peak {summary.peak.messages}/h · {formatHour(summary.peak.hour)}
        </p>
      </div>

      <ChartContainer
        config={CHART_CONFIG}
        className="mt-3 h-40 w-full"
        initialDimension={{ width: 640, height: 160 }}
      >
        <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="chatMessagesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-messages)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-messages)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            type="monotone"
            dataKey="messages"
            stroke="var(--color-messages)"
            strokeWidth={2.5}
            fill="url(#chatMessagesFill)"
            activeDot={{ r: 4, fill: 'var(--color-messages)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>

      <div className="mt-auto flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-2 bg-primary" /> Messages / hour
        </span>
        <span>Auto-refresh · 30s</span>
      </div>
    </div>
  );
}
