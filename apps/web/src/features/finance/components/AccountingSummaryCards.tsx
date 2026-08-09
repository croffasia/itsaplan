import { ArrowDownLeft, ArrowUpRight, Landmark, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '../utils/finance';
import type { AccountingSummary } from '../utils/accounting';

export default function AccountingSummaryCards({ summary }: { summary: AccountingSummary }) {
  const cards = [
    { label: 'Revenue excl. VAT', value: summary.revenue, icon: ArrowDownLeft },
    {
      label: 'Expenses excl. VAT',
      value: summary.expenses,
      icon: ArrowUpRight,
    },
    { label: 'Profit / loss', value: summary.result, icon: Scale },
    { label: 'VAT position', value: summary.vatPosition, icon: Landmark },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 py-5 shadow-none">
          <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent
            className={`px-5 text-2xl font-semibold tracking-tight tabular-nums ${card.value < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}
          >
            {formatMoney(card.value)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
