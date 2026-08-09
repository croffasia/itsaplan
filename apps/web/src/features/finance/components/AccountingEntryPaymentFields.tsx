import type { FinancePaymentStatus } from '@/lib/api';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AccountingEntryFormState } from '../hooks/useAccountingEntryForm';

export default function AccountingEntryPaymentFields({ form }: { form: AccountingEntryFormState }) {
  const { values, patch } = form;

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
      <div className="space-y-1.5">
        <Label htmlFor="accounting-status">Payment status</Label>
        <Select
          value={values.paymentStatus}
          onValueChange={(status) => patch({ paymentStatus: status as FinancePaymentStatus })}
        >
          <SelectTrigger id="accounting-status" className="w-full rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="open">Open</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-description">Description</Label>
        <Textarea
          id="accounting-description"
          value={values.description}
          maxLength={200}
          rows={2}
          placeholder="What was this entry for?"
          onChange={(event) => patch({ description: event.target.value })}
        />
      </div>
    </div>
  );
}
