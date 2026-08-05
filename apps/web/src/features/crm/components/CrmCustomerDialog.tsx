import type { CrmCustomer, CrmCustomerInput } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { useCreateCrmCustomer, useUpdateCrmCustomer } from '../services/crm.service';
import CrmCustomerForm from './CrmCustomerForm';

export default function CrmCustomerDialog({
  projectKey,
  customer,
  onClose,
  onSaved,
}: {
  projectKey: string;
  customer?: CrmCustomer;
  onClose: () => void;
  onSaved?: (customer: CrmCustomer) => void;
}) {
  const create = useCreateCrmCustomer(projectKey);
  const update = useUpdateCrmCustomer(projectKey, customer?.id ?? '');

  const submit = async (input: CrmCustomerInput) => {
    const saved = customer ? await update.mutateAsync(input) : await create.mutateAsync(input);
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      title={customer ? 'Edit customer' : 'New customer'}
      description="Store the customer relationship details used by your team."
      projectKey={projectKey}
      wide="xl"
      onClose={onClose}
    >
      <CrmCustomerForm
        customer={customer}
        pending={create.isPending || update.isPending}
        onCancel={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}
