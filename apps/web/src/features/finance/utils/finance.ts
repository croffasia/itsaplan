import type { FinanceTransaction } from '@/lib/api';
import { toDateStr } from '@/utils/dates';

const currency = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

export function formatMoney(amountCents: number): string {
  return currency.format(amountCents / 100);
}

export function amountToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function centsToAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export interface FinanceSummary {
  income: number;
  expenses: number;
  balance: number;
  monthNet: number;
}

export function financeSummary(transactions: FinanceTransaction[]): FinanceSummary {
  const currentMonth = toDateStr(new Date()).slice(0, 7);
  let income = 0;
  let expenses = 0;
  let monthNet = 0;

  for (const transaction of transactions) {
    const signed =
      transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents;
    if (transaction.type === 'income') income += transaction.amountCents;
    else expenses += transaction.amountCents;
    if (transaction.transactionDate.startsWith(currentMonth)) monthNet += signed;
  }

  return { income, expenses, balance: income - expenses, monthNet };
}

export interface FinanceMonth {
  month: string;
  label: string;
  income: number;
  expenses: number;
}

export function financeMonths(transactions: FinanceTransaction[]): FinanceMonth[] {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      income: 0,
      expenses: 0,
    };
  });
  const byMonth = new Map(months.map((month) => [month.month, month]));

  for (const transaction of transactions) {
    const month = byMonth.get(transaction.transactionDate.slice(0, 7));
    if (month)
      month[transaction.type === 'income' ? 'income' : 'expenses'] += transaction.amountCents;
  }
  return months;
}

export interface FinanceCategoryTotal {
  category: string;
  amount: number;
}

export function expenseCategories(transactions: FinanceTransaction[]): FinanceCategoryTotal[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    totals.set(
      transaction.category,
      (totals.get(transaction.category) ?? 0) + transaction.amountCents,
    );
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}
