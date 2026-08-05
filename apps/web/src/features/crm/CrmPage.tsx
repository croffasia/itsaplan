'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { crmCustomerPath } from '@/utils/paths';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CrmCustomerDialog from './components/CrmCustomerDialog';
import CrmCustomersTable from './components/CrmCustomersTable';
import CrmEmptyState from './components/CrmEmptyState';
import { useCrmCustomersQuery } from './services/crm.service';

export default function CrmPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const router = useRouter();
  const projectKey = project?.project.key ?? '';
  const customersQuery = useCrmCustomersQuery(projectKey);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const canCreate = can('crm', 'create');

  const customers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customersQuery.data ?? [];
    return (customersQuery.data ?? []).filter((customer) =>
      [customer.name, customer.service, customer.owner, customer.nextAction].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [customersQuery.data, search]);

  if (!project || customersQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('crm', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to CRM.
      </div>
    );
  }

  return (
    <SectionPageView
      title="CRM"
      description="Customers, project progress, and the next action for your team."
      actions={
        canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add customer
          </Button>
        ) : undefined
      }
      wide
    >
      {(customersQuery.data?.length ?? 0) === 0 ? (
        <CrmEmptyState canCreate={canCreate} onCreate={() => setCreating(true)} />
      ) : (
        <div className="space-y-4 pb-8">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              placeholder="Search customers…"
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {customers.length > 0 ? (
            <CrmCustomersTable customers={customers} projectKey={projectKey} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No customers match your search.
            </p>
          )}
        </div>
      )}

      {creating && (
        <CrmCustomerDialog
          projectKey={projectKey}
          onClose={() => setCreating(false)}
          onSaved={(customer) => router.push(crmCustomerPath(projectKey, customer.id))}
        />
      )}
    </SectionPageView>
  );
}
