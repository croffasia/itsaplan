'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { FinanceMonth } from '../utils/finance';
import { formatMoney } from '../utils/finance';

const CHART_CONFIG: ChartConfig = {
  income: { label: 'Income', color: '#22c55e' },
  expenses: { label: 'Expenses', color: '#f43f5e' },
};

function compactMoney(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export default function FinanceCashFlowChart({ months }: { months: FinanceMonth[] }) {
  const hasData = months.some((month) => month.income > 0 || month.expenses > 0);

  return (
    <Card className="gap-4 shadow-none lg:col-span-2">
      <CardHeader>
        <CardTitle>Cash flow</CardTitle>
        <CardDescription>Income and expenses over the last six months.</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={CHART_CONFIG} className="h-[280px] w-full">
            <BarChart data={months} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={48}
                tickFormatter={compactMoney}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-36 items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {CHART_CONFIG[String(name)]?.label}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatMoney(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Add a transaction to start the cash flow chart.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
