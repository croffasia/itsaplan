import type { FinanceTransactionType, FinanceVatRate } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountingEntryFormState } from '../hooks/useAccountingEntryForm';
import { formatMoney } from '../utils/finance';

const ACCOUNTS = [
  'Sales',
  'Services',
  'Software',
  'Marketing',
  'Office',
  'Travel',
  'Taxes',
  'Other',
];

export default function AccountingEntryCoreFields({ form }: { form: AccountingEntryFormState }) {
  const { values, patch, amountCents, vatAmount } = form;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-type">Entry type</Label>
        <Select
          value={values.type}
          onValueChange={(type) => patch({ type: type as FinanceTransactionType })}
        >
          <SelectTrigger id="accounting-type" className="w-full rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Sale</SelectItem>
            <SelectItem value="expense">Purchase</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-amount">Amount incl. VAT (EUR)</Label>
        <Input
          id="accounting-amount"
          value={values.amount}
          inputMode="decimal"
          required
          autoFocus
          placeholder="0.00"
          aria-invalid={values.amount.length > 0 && amountCents === null}
          onChange={(event) => patch({ amount: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-vat">VAT rate</Label>
        <Select
          value={String(values.vatRate)}
          onValueChange={(rate) => patch({ vatRate: Number(rate) as FinanceVatRate })}
        >
          <SelectTrigger id="accounting-vat" className="w-full rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0%</SelectItem>
            <SelectItem value="9">9%</SelectItem>
            <SelectItem value="21">21%</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">VAT amount: {formatMoney(vatAmount)}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accounting-account">Ledger account</Label>
        <Input
          id="accounting-account"
          list="accounting-accounts"
          value={values.category}
          required
          maxLength={200}
          placeholder={values.type === 'income' ? 'Sales' : 'Software'}
          onChange={(event) => patch({ category: event.target.value })}
        />
        <datalist id="accounting-accounts">
          {ACCOUNTS.map((account) => (
            <option key={account} value={account} />
          ))}
        </datalist>
      </div>
    </>
  );
}
