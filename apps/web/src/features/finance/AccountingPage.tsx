'use client';

import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import AccountingDialogs from './components/AccountingDialogs';
import AccountingEmptyState from './components/AccountingEmptyState';
import AccountingEntriesHeader from './components/AccountingEntriesHeader';
import AccountingEntriesTable from './components/AccountingEntriesTable';
import AccountingPageActions from './components/AccountingPageActions';
import AccountingProfitLossCard from './components/AccountingProfitLossCard';
import AccountingSummaryCards from './components/AccountingSummaryCards';
import AccountingTaxCard from './components/AccountingTaxCard';
import { useAccountingPage } from './hooks/useAccountingPage';

export default function AccountingPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const state = useAccountingPage(projectKey);

  if (!project || state.transactionsQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('finance', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to accounting.
      </div>
    );
  }

  const canCreate = can('finance', 'create');
  let entriesContent = (
    <p className="py-10 text-center text-sm text-muted-foreground">
      No entries match this financial year and filters.
    </p>
  );
  if (state.transactions.length === 0) {
    entriesContent = (
      <AccountingEmptyState canCreate={canCreate} onCreate={() => state.setCreating(true)} />
    );
  } else if (state.filtered.length > 0) {
    entriesContent = (
      <AccountingEntriesTable
        transactions={state.filtered}
        canEdit={can('finance', 'edit')}
        canDelete={can('finance', 'delete')}
        onEdit={state.setEditing}
        onDelete={state.setDeleting}
      />
    );
  }

  return (
    <SectionPageView
      title="Accounting"
      description="Manage sales, purchases, VAT, results, and outstanding payments in one place."
      actions={<AccountingPageActions state={state} canCreate={canCreate} />}
      wide
    >
      <div className="space-y-6 pb-8">
        <AccountingSummaryCards summary={state.summary} />
        <div className="grid gap-4 lg:grid-cols-3">
          <AccountingProfitLossCard summary={state.summary} />
          <AccountingTaxCard summary={state.summary} />
        </div>
        <section className="space-y-4">
          <AccountingEntriesHeader
            count={state.yearTransactions.length}
            search={state.search}
            type={state.type}
            status={state.status}
            onSearchChange={state.setSearch}
            onTypeChange={state.setType}
            onStatusChange={state.setStatus}
          />
          {entriesContent}
        </section>
      </div>
      <AccountingDialogs projectKey={projectKey} state={state} />
    </SectionPageView>
  );
}
