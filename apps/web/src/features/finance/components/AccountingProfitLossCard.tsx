import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '../utils/finance';
import type { AccountingSummary } from '../utils/accounting';

export default function AccountingProfitLossCard({ summary }: { summary: AccountingSummary }) {
  const rows = [
    { label: 'Revenue', value: summary.revenue },
    { label: 'Operating expenses', value: -summary.expenses },
  ];

  return (
    <Card className="gap-4 shadow-none lg:col-span-2">
      <CardHeader>
        <CardTitle>Profit and loss</CardTitle>
        <CardDescription>
          Net amounts excluding VAT for the selected financial year.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">{formatMoney(row.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-semibold">Net result</span>
            <span
              className={`text-lg font-semibold tabular-nums ${summary.result < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}
            >
              {formatMoney(summary.result)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
