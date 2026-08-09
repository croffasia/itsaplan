'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { FinanceTransaction, FinanceTransactionType } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import FinanceCashFlowChart from './components/FinanceCashFlowChart';
import FinanceCategoryBreakdown from './components/FinanceCategoryBreakdown';
import FinanceEmptyState from './components/FinanceEmptyState';
import FinanceSummaryCards from './components/FinanceSummaryCards';
import FinanceTransactionDialog from './components/FinanceTransactionDialog';
import FinanceTransactionsTable from './components/FinanceTransactionsTable';
import { expenseCategories, financeMonths, financeSummary, formatMoney } from './utils/finance';
import {
  useDeleteFinanceTransaction,
  useFinanceTransactionsQuery,
} from './services/finance.service';

type TypeFilter = FinanceTransactionType | 'all';

export default function FinancePage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const transactionsQuery = useFinanceTransactionsQuery(projectKey);
  const remove = useDeleteFinanceTransaction(projectKey);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const summary = useMemo(() => financeSummary(transactions), [transactions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter(
      (transaction) =>
        (type === 'all' || transaction.type === type) &&
        (!query ||
          transaction.category.toLowerCase().includes(query) ||
          transaction.description.toLowerCase().includes(query)),
    );
  }, [search, transactions, type]);

  if (!project || transactionsQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('finance', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to finance.
      </div>
    );
  }

  const canCreate = can('finance', 'create');

  return (
    <SectionPageView
      title="Finance"
      description="Track income, expenses, and cash flow without connecting another platform."
      actions={
        canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add transaction
          </Button>
        ) : undefined
      }
      wide
    >
      <div className="space-y-6 pb-8">
        <FinanceSummaryCards summary={summary} />
        <div className="grid gap-4 lg:grid-cols-3">
          <FinanceCashFlowChart months={financeMonths(transactions)} />
          <FinanceCategoryBreakdown categories={expenseCategories(transactions)} />
        </div>
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">Transactions</h2>
              <p className="text-sm text-muted-foreground">
                {transactions.length} total · {formatMoney(summary.balance)} balance
              </p>
            </div>
            {transactions.length > 0 && (
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1 sm:w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    type="search"
                    className="pl-9"
                    placeholder="Search transactions…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Select value={type} onValueChange={(value) => setType(value as TypeFilter)}>
                  <SelectTrigger className="w-32 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {transactions.length === 0 ? (
            <FinanceEmptyState canCreate={canCreate} onCreate={() => setCreating(true)} />
          ) : filtered.length > 0 ? (
            <FinanceTransactionsTable
              transactions={filtered}
              canEdit={can('finance', 'edit')}
              canDelete={can('finance', 'delete')}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No transactions match your filters.
            </p>
          )}
        </section>
      </div>
      {(creating || editing) && (
        <FinanceTransactionDialog
          projectKey={projectKey}
          transaction={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete transaction?"
          confirmLabel="Delete transaction"
          onConfirm={async () => {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <p className="text-sm text-muted-foreground">
            This {deleting.type} of {formatMoney(deleting.amountCents)} will be permanently removed.
          </p>
        </ConfirmDialog>
      )}
    </SectionPageView>
  );
}
