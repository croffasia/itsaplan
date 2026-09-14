'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { SocialDashboard } from '@/lib/api';
import { compactNumber } from '../utils/social';

const config = { reach: { label: 'Reach', color: 'var(--primary)' } } satisfies ChartConfig;

export default function SocialTrendCard({ daily }: { daily: SocialDashboard['daily'] }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>Reach trend</CardTitle>
        <CardDescription>Daily Instagram reach in the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        {daily.length > 1 ? (
          <ChartContainer config={config} className="h-[150px] w-full">
            <AreaChart data={daily} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis hide domain={[0, 'dataMax']} />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => compactNumber(Number(value))} />
                }
              />
              <Area
                dataKey="reach"
                type="monotone"
                fill="var(--color-reach)"
                fillOpacity={0.12}
                stroke="var(--color-reach)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[150px] items-center justify-center text-center text-sm text-muted-foreground">
            More daily data is needed to show a trend.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
