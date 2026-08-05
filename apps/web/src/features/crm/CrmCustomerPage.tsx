'use client';

import { useParams } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import CrmCustomerActions from './components/CrmCustomerActions';
import CrmCustomerDetails from './components/CrmCustomerDetails';
import CrmStatusBadge from './components/CrmStatusBadge';
import { useCrmCustomerQuery } from './services/crm.service';

export default function CrmCustomerPage() {
  const params = useParams<{ customerId: string }>();
  const { project } = useShell();
  const { can } = usePermissions();
  const customerId = params.customerId ?? '';
  const customerQuery = useCrmCustomerQuery(customerId);

  if (!project || customerQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('crm', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to CRM.
      </div>
    );
  }
  if (!customerQuery.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Customer not found.
      </div>
    );
  }

  const customer = customerQuery.data;
  const projectKey = project.project.key;

  return (
    <SectionPageView
      title={customer.name}
      description={
        <span className="flex items-center gap-2">
          <CrmStatusBadge status={customer.status} />
          <span>{customer.owner ? `Owned by ${customer.owner}` : 'No owner assigned'}</span>
        </span>
      }
      actions={<CrmCustomerActions customer={customer} projectKey={projectKey} />}
      wide
    >
      <CrmCustomerDetails customer={customer} projectKey={projectKey} />
    </SectionPageView>
  );
}
