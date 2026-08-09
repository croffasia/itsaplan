import { useState, type FormEvent } from 'react';
import type {
  FinancePaymentStatus,
  FinanceTransaction,
  FinanceTransactionInput,
  FinanceTransactionType,
  FinanceVatRate,
} from '@/lib/api';
import { toDateStr } from '@/utils/dates';
import { vatFromGross } from '../utils/accounting';
import { amountToCents, centsToAmount } from '../utils/finance';

interface AccountingEntryValues {
  type: FinanceTransactionType;
  amount: string;
  category: string;
  counterparty: string;
  reference: string;
  vatRate: FinanceVatRate;
  paymentStatus: FinancePaymentStatus;
  transactionDate: string;
  dueDate: string;
  description: string;
}

function initialValues(transaction?: FinanceTransaction): AccountingEntryValues {
  return {
    type: transaction?.type ?? 'income',
    amount: transaction ? centsToAmount(transaction.amountCents) : '',
    category: transaction?.category ?? '',
    counterparty: transaction?.counterparty ?? '',
    reference: transaction?.reference ?? '',
    vatRate: transaction?.vatRate ?? 21,
    paymentStatus: transaction?.paymentStatus ?? 'paid',
    transactionDate: transaction?.transactionDate ?? toDateStr(new Date()),
    dueDate: transaction?.dueDate ?? '',
    description: transaction?.description ?? '',
  };
}

export function useAccountingEntryForm(
  transaction: FinanceTransaction | undefined,
  onSubmit: (input: FinanceTransactionInput) => Promise<void>,
) {
  const [values, setValues] = useState(() => initialValues(transaction));
  const amountCents = amountToCents(values.amount);
  const vatAmount = amountCents === null ? 0 : vatFromGross(amountCents, values.vatRate);
  const valid = amountCents !== null && Boolean(values.category.trim() && values.transactionDate);
  const patch = (next: Partial<AccountingEntryValues>) =>
    setValues((current) => ({ ...current, ...next }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || amountCents === null) return;
    void onSubmit({
      type: values.type,
      amountCents,
      category: values.category,
      description: values.description,
      counterparty: values.counterparty,
      reference: values.reference,
      vatRate: values.vatRate,
      paymentStatus: values.paymentStatus,
      transactionDate: values.transactionDate,
      dueDate: values.dueDate || null,
    });
  };

  return { values, patch, amountCents, vatAmount, valid, submit };
}

export type AccountingEntryFormState = ReturnType<typeof useAccountingEntryForm>;
