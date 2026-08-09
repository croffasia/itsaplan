import type { FinanceTransaction, FinanceVatRate } from '@/lib/api';

export interface AccountingSummary {
  revenue: number;
  expenses: number;
  result: number;
  vatCollected: number;
  vatDeductible: number;
  vatPosition: number;
  receivables: number;
  payables: number;
}

export function vatFromGross(amountCents: number, vatRate: FinanceVatRate): number {
  return Math.round((amountCents * vatRate) / (100 + vatRate));
}

export function accountingSummary(transactions: FinanceTransaction[]): AccountingSummary {
  const summary: AccountingSummary = {
    revenue: 0,
    expenses: 0,
    result: 0,
    vatCollected: 0,
    vatDeductible: 0,
    vatPosition: 0,
    receivables: 0,
    payables: 0,
  };

  for (const transaction of transactions) {
    const net = transaction.amountCents - transaction.vatAmountCents;
    if (transaction.type === 'income') {
      summary.revenue += net;
      summary.vatCollected += transaction.vatAmountCents;
      if (transaction.paymentStatus === 'open') summary.receivables += transaction.amountCents;
    } else {
      summary.expenses += net;
      summary.vatDeductible += transaction.vatAmountCents;
      if (transaction.paymentStatus === 'open') summary.payables += transaction.amountCents;
    }
  }

  summary.result = summary.revenue - summary.expenses;
  summary.vatPosition = summary.vatCollected - summary.vatDeductible;
  return summary;
}

export function accountingYears(transactions: FinanceTransaction[]): string[] {
  const years = new Set(transactions.map((transaction) => transaction.transactionDate.slice(0, 4)));
  years.add(String(new Date().getFullYear()));
  return [...years].sort((a, b) => b.localeCompare(a));
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function accountingCsv(transactions: FinanceTransaction[]): string {
  const rows = transactions.map((transaction) =>
    [
      transaction.transactionDate,
      transaction.type,
      transaction.reference,
      transaction.counterparty,
      transaction.category,
      (transaction.amountCents / 100).toFixed(2),
      transaction.vatRate,
      (transaction.vatAmountCents / 100).toFixed(2),
      transaction.paymentStatus,
      transaction.dueDate ?? '',
      transaction.description,
    ]
      .map(csvCell)
      .join(','),
  );
  return [
    'Date,Type,Reference,Counterparty,Account,Gross amount,VAT rate,VAT amount,Payment status,Due date,Description',
    ...rows,
  ].join('\n');
}
