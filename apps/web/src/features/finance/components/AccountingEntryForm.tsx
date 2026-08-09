import type { FinanceTransaction, FinanceTransactionInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAccountingEntryForm } from '../hooks/useAccountingEntryForm';
import AccountingEntryCoreFields from './AccountingEntryCoreFields';
import AccountingEntryMetaFields from './AccountingEntryMetaFields';
import AccountingEntryPaymentFields from './AccountingEntryPaymentFields';

export default function AccountingEntryForm({
  transaction,
  pending,
  onCancel,
  onSubmit,
}: {
  transaction?: FinanceTransaction;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: FinanceTransactionInput) => Promise<void>;
}) {
  const form = useAccountingEntryForm(transaction, onSubmit);
  let submitLabel = 'Add entry';
  if (transaction) submitLabel = 'Save changes';
  if (pending) submitLabel = 'Saving…';

  return (
    <form className="space-y-5" onSubmit={form.submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountingEntryCoreFields form={form} />
        <AccountingEntryMetaFields form={form} />
      </div>
      <AccountingEntryPaymentFields form={form} />
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!form.valid || pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
