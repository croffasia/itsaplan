import { ArrowDownLeft, ArrowUpRight, Scale, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceSummary } from '../utils/finance';
import { formatMoney } from '../utils/finance';

export default function FinanceSummaryCards({ summary }: { summary: FinanceSummary }) {
  const cards = [
    {
      label: 'Total income',
      value: summary.income,
      icon: ArrowDownLeft,
      tone: 'text-emerald-500',
    },
    {
      label: 'Total expenses',
      value: summary.expenses,
      icon: ArrowUpRight,
      tone: 'text-rose-500',
    },
    {
      label: 'Net balance',
      value: summary.balance,
      icon: Scale,
      tone: 'text-foreground',
    },
    {
      label: 'This month',
      value: summary.monthNet,
      icon: TrendingUp,
      tone: 'text-foreground',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 py-5 shadow-none">
          <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className={`size-4 ${card.tone}`} />
          </CardHeader>
          <CardContent
            className={`px-5 text-2xl font-semibold tracking-tight tabular-nums ${card.tone}`}
          >
            {formatMoney(card.value)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
