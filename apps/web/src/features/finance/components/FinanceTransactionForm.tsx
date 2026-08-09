import { useState, type FormEvent } from 'react';
import type { FinanceTransaction, FinanceTransactionInput } from '@/lib/api';
import { toDateStr } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { amountToCents, centsToAmount } from '../utils/finance';

const CATEGORIES = [
  'Sales',
  'Retainer',
  'Software',
  'Marketing',
  'Office',
  'Travel',
  'Taxes',
  'Other',
];

function transactionInput(transaction?: FinanceTransaction) {
  return {
    type: transaction?.type ?? ('income' as const),
    amount: transaction ? centsToAmount(transaction.amountCents) : '',
    category: transaction?.category ?? '',
    description: transaction?.description ?? '',
    transactionDate: transaction?.transactionDate ?? toDateStr(new Date()),
  };
}

export default function FinanceTransactionForm({
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
  const [values, setValues] = useState(() => transactionInput(transaction));
  const amountCents = amountToCents(values.amount);
  const valid = amountCents !== null && values.category.trim() && values.transactionDate;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || amountCents === null) return;
    void onSubmit({
      type: values.type,
      amountCents,
      category: values.category,
      description: values.description,
      transactionDate: values.transactionDate,
    });
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="finance-type">Type</Label>
          <Select
            value={values.type}
            onValueChange={(type) =>
              setValues((current) => ({
                ...current,
                type: type as 'income' | 'expense',
              }))
            }
          >
            <SelectTrigger id="finance-type" className="w-full rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finance-amount">Amount (EUR)</Label>
          <Input
            id="finance-amount"
            value={values.amount}
            inputMode="decimal"
            autoFocus
            required
            placeholder="0.00"
            aria-invalid={values.amount.length > 0 && amountCents === null}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finance-category">Category</Label>
          <Input
            id="finance-category"
            list="finance-categories"
            value={values.category}
            required
            maxLength={200}
            placeholder={values.type === 'income' ? 'Sales' : 'Software'}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />
          <datalist id="finance-categories">
            {CATEGORIES.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finance-date">Date</Label>
          <Input
            id="finance-date"
            type="date"
            value={values.transactionDate}
            required
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                transactionDate: event.target.value,
              }))
            }
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="finance-description">Description</Label>
        <Input
          id="finance-description"
          value={values.description}
          maxLength={200}
          placeholder="Invoice, subscription, equipment…"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || pending}>
          {pending ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  );
}
