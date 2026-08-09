import { Pencil, Trash2 } from 'lucide-react';
import type { FinanceTransaction } from '@/lib/api';
import { formatDate, toDateStr } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatMoney } from '../utils/finance';

function paymentBadge(transaction: FinanceTransaction): { label: string; className: string } {
  if (transaction.paymentStatus === 'paid') {
    return {
      label: 'Paid',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }
  const overdue = transaction.dueDate !== null && transaction.dueDate < toDateStr(new Date());
  if (overdue) {
    return { label: 'Overdue', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' };
  }
  return { label: 'Open', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
}

export default function AccountingEntryRow({
  transaction,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  transaction: FinanceTransaction;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const income = transaction.type === 'income';
  const payment = paymentBadge(transaction);

  return (
    <TableRow>
      <TableCell className="px-3 text-muted-foreground">
        {formatDate(transaction.transactionDate)}
      </TableCell>
      <TableCell className="max-w-0 px-3">
        <span className="block truncate font-medium">
          {transaction.reference || 'No reference'}
        </span>
        <span className="text-xs text-muted-foreground">{income ? 'Sale' : 'Purchase'}</span>
      </TableCell>
      <TableCell className="max-w-0 px-3">
        <span className="block truncate">{transaction.counterparty || '—'}</span>
      </TableCell>
      <TableCell className="max-w-0 px-3">
        <span className="block truncate text-muted-foreground">{transaction.category}</span>
      </TableCell>
      <TableCell className="px-3">
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${payment.className}`}>
          {payment.label}
        </span>
      </TableCell>
      <TableCell className="px-3 text-right text-muted-foreground tabular-nums">
        {formatMoney(transaction.vatAmountCents)}
      </TableCell>
      <TableCell
        className={`px-3 text-right font-semibold tabular-nums ${income ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
      >
        {income ? '+' : '-'}
        {formatMoney(transaction.amountCents)}
      </TableCell>
      <TableCell className="px-3 text-right">
        <div className="flex justify-end gap-1">
          {canEdit && (
            <Button variant="ghost" size="icon-xs" aria-label="Edit entry" onClick={onEdit}>
              <Pencil />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete entry"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
