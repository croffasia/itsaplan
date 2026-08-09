import type { FinanceTransaction, FinanceTransactionInput } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import {
  useCreateFinanceTransaction,
  useUpdateFinanceTransaction,
} from '../services/finance.service';
import FinanceTransactionForm from './FinanceTransactionForm';

export default function FinanceTransactionDialog({
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
      title={transaction ? 'Edit transaction' : 'New transaction'}
      description="Record income or an expense manually in this project."
      projectKey={projectKey}
      onClose={onClose}
    >
      <FinanceTransactionForm
        transaction={transaction}
        pending={create.isPending || update.isPending}
        onCancel={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}
