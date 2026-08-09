import { Pencil, Trash2 } from 'lucide-react';
import type { FinanceTransaction } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatMoney } from '../utils/finance';

export default function FinanceTransactionRow({
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

  return (
    <TableRow>
      <TableCell className="px-3 text-muted-foreground">
        {formatDate(transaction.transactionDate)}
      </TableCell>
      <TableCell className="px-3">
        <span
          className={
            income
              ? 'rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'
              : 'rounded-md bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400'
          }
        >
          {income ? 'Income' : 'Expense'}
        </span>
      </TableCell>
      <TableCell className="px-3 font-medium">{transaction.category}</TableCell>
      <TableCell className="max-w-0 px-3">
        <span className="block truncate text-muted-foreground">
          {transaction.description || 'No description'}
        </span>
      </TableCell>
      <TableCell className="px-3 text-muted-foreground">
        {transaction.createdByName ?? 'Former member'}
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
            <Button variant="ghost" size="icon-xs" aria-label="Edit transaction" onClick={onEdit}>
              <Pencil />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete transaction"
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
