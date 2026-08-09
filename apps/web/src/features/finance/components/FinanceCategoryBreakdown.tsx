import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceCategoryTotal } from '../utils/finance';
import { formatMoney } from '../utils/finance';

export default function FinanceCategoryBreakdown({
  categories,
}: {
  categories: FinanceCategoryTotal[];
}) {
  const maximum = categories[0]?.amount ?? 0;

  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>Top expenses</CardTitle>
        <CardDescription>Largest expense categories across all transactions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {categories.length > 0 ? (
          categories.map((category) => (
            <div key={category.category} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{category.category}</span>
                <span className="font-medium tabular-nums">{formatMoney(category.amount)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{
                    width: `${Math.max(4, (category.amount / maximum) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
            Expense categories appear here after you add an expense.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
