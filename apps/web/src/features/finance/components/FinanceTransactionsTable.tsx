import type { FinanceTransaction } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FinanceTransactionRow from './FinanceTransactionRow';

export default function FinanceTransactionsTable({
  transactions,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  transactions: FinanceTransaction[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (transaction: FinanceTransaction) => void;
  onDelete: (transaction: FinanceTransaction) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[920px] table-fixed">
        <colgroup>
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[16%]" />
          <col className="w-[25%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[7%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs text-muted-foreground">Date</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Type</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Category</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Description</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Added by</TableHead>
            <TableHead className="px-3 text-right text-xs text-muted-foreground">Amount</TableHead>
            <TableHead aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <FinanceTransactionRow
              key={transaction.id}
              transaction={transaction}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => onEdit(transaction)}
              onDelete={() => onDelete(transaction)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
