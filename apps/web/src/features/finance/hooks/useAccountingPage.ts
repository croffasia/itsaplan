import { useMemo, useState } from 'react';
import type { FinanceTransaction } from '@/lib/api';
import { accountingCsv, accountingSummary, accountingYears } from '../utils/accounting';
import type {
  AccountingStatusFilter,
  AccountingTypeFilter,
} from '../components/AccountingEntriesHeader';
import {
  useDeleteFinanceTransaction,
  useFinanceTransactionsQuery,
} from '../services/finance.service';

export function useAccountingPage(projectKey: string) {
  const transactionsQuery = useFinanceTransactionsQuery(projectKey);
  const remove = useDeleteFinanceTransaction(projectKey);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AccountingTypeFilter>('all');
  const [status, setStatus] = useState<AccountingStatusFilter>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const years = useMemo(() => accountingYears(transactions), [transactions]);
  const yearTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.transactionDate.startsWith(year)),
    [transactions, year],
  );
  const summary = useMemo(() => accountingSummary(yearTransactions), [yearTransactions]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return yearTransactions.filter(
      (transaction) =>
        (type === 'all' || transaction.type === type) &&
        (status === 'all' || transaction.paymentStatus === status) &&
        (!query ||
          transaction.reference.toLowerCase().includes(query) ||
          transaction.counterparty.toLowerCase().includes(query) ||
          transaction.category.toLowerCase().includes(query) ||
          transaction.description.toLowerCase().includes(query)),
    );
  }, [search, status, type, yearTransactions]);

  const exportCsv = () => {
    const blob = new Blob(['\uFEFF', accountingCsv(yearTransactions)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectKey}-accounting-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    transactionsQuery,
    remove,
    year,
    setYear,
    search,
    setSearch,
    type,
    setType,
    status,
    setStatus,
    creating,
    setCreating,
    editing,
    setEditing,
    deleting,
    setDeleting,
    transactions,
    years,
    yearTransactions,
    summary,
    filtered,
    exportCsv,
  };
}

export type AccountingPageState = ReturnType<typeof useAccountingPage>;
