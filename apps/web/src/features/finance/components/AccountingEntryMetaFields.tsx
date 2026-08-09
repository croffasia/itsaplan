import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AccountingEntryFormState } from '../hooks/useAccountingEntryForm';

export default function AccountingEntryMetaFields({ form }: { form: AccountingEntryFormState }) {
  const { values, patch } = form;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-counterparty">Customer or supplier</Label>
        <Input
          id="accounting-counterparty"
          value={values.counterparty}
          maxLength={200}
          placeholder="Company name"
          onChange={(event) => patch({ counterparty: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-reference">Invoice or reference</Label>
        <Input
          id="accounting-reference"
          value={values.reference}
          maxLength={100}
          placeholder="INV-2026-001"
          onChange={(event) => patch({ reference: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-date">Book date</Label>
        <Input
          id="accounting-date"
          type="date"
          value={values.transactionDate}
          required
          onChange={(event) => patch({ transactionDate: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-due-date">Due date</Label>
        <Input
          id="accounting-due-date"
          type="date"
          value={values.dueDate}
          onChange={(event) => patch({ dueDate: event.target.value })}
        />
      </div>
    </>
  );
}
