import type { FinanceTransaction } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccountingEntryRow from './AccountingEntryRow';

export default function AccountingEntriesTable({
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
      <Table className="min-w-[1050px] table-fixed">
        <colgroup>
          <col className="w-[11%]" />
          <col className="w-[15%]" />
          <col className="w-[17%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[14%]" />
          <col className="w-[7%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs text-muted-foreground">Date</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Reference</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">
              Customer / supplier
            </TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Account</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Status</TableHead>
            <TableHead className="px-3 text-right text-xs text-muted-foreground">VAT</TableHead>
            <TableHead className="px-3 text-right text-xs text-muted-foreground">Gross</TableHead>
            <TableHead aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <AccountingEntryRow
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
