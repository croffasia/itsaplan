import type { FinanceTransaction, FinanceTransactionInput } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import {
  useCreateFinanceTransaction,
  useUpdateFinanceTransaction,
} from '../services/finance.service';
import AccountingEntryForm from './AccountingEntryForm';

export default function AccountingEntryDialog({
  projectKey,
  transaction,
  onClose,
}: {
  projectKey: string;
  transaction?: FinanceTransaction;
  onClose: () => void;
}) {
  const create = useCreateFinanceTransaction(projectKey);
  const update = useUpdateFinanceTransaction(projectKey);

  const submit = async (input: FinanceTransactionInput) => {
    if (transaction) await update.mutateAsync({ id: transaction.id, input });
    else await create.mutateAsync(input);
    onClose();
  };

  return (
    <Modal
      title={transaction ? 'Edit bookkeeping entry' : 'New bookkeeping entry'}
      description="Record a sale or purchase, including VAT and payment details."
      projectKey={projectKey}
      onClose={onClose}
      wide
    >
      <AccountingEntryForm
        transaction={transaction}
        pending={create.isPending || update.isPending}
        onCancel={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}
