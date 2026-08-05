import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import type { CrmCustomer } from '@/lib/api';
import { crmPath } from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useDeleteCrmCustomer } from '../services/crm.service';
import CrmCustomerDialog from './CrmCustomerDialog';

export default function CrmCustomerActions({
  customer,
  projectKey,
}: {
  customer: CrmCustomer;
  projectKey: string;
}) {
  const { can } = usePermissions();
  const router = useRouter();
  const remove = useDeleteCrmCustomer(projectKey);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteCustomer = async () => {
    await remove.mutateAsync(customer.id);
    router.push(crmPath(projectKey));
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={crmPath(projectKey)}>
            <ArrowLeft />
            CRM
          </Link>
        </Button>
        {can('crm', 'edit') && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
        )}
        {can('crm', 'delete') && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete customer"
            title="Delete customer"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      {editing && (
        <CrmCustomerDialog
          projectKey={projectKey}
          customer={customer}
          onClose={() => setEditing(false)}
        />
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${customer.name}?`}
          confirmLabel="Delete customer"
          onConfirm={deleteCustomer}
          onClose={() => setConfirmingDelete(false)}
        >
          <p className="text-sm text-muted-foreground">
            The CRM record will be permanently removed. Linked files remain available in Files.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
