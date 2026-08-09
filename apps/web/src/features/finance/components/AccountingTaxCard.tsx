import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '../utils/finance';
import type { AccountingSummary } from '../utils/accounting';

export default function AccountingTaxCard({ summary }: { summary: AccountingSummary }) {
  const vatLabel = summary.vatPosition >= 0 ? 'VAT payable' : 'VAT reclaimable';

  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>VAT and outstanding</CardTitle>
        <CardDescription>Current tax position and unpaid amounts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">VAT collected</span>
          <span className="font-medium tabular-nums">{formatMoney(summary.vatCollected)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Deductible VAT</span>
          <span className="font-medium tabular-nums">{formatMoney(summary.vatDeductible)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-4">
          <span className="font-medium">{vatLabel}</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(Math.abs(summary.vatPosition))}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Receivables</p>
            <p className="mt-1 font-semibold tabular-nums">{formatMoney(summary.receivables)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Payables</p>
            <p className="mt-1 font-semibold tabular-nums">{formatMoney(summary.payables)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
