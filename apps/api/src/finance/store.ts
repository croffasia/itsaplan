import { db, financeTransaction, user } from '@repo/db';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

type FinanceTransactionSelect = typeof financeTransaction.$inferSelect & {
  createdByName: string | null;
};

export type FinanceTransactionType = 'income' | 'expense';
export type FinancePaymentStatus = 'open' | 'paid';
export type FinanceVatRate = 0 | 9 | 21;

export interface FinanceTransactionRow {
  id: number;
  publicId: string;
  projectId: number;
  createdByUserId: string | null;
  createdByName: string | null;
  type: FinanceTransactionType;
  amountCents: number;
  category: string;
  description: string;
  counterparty: string;
  reference: string;
  vatRate: FinanceVatRate;
  vatAmountCents: number;
  paymentStatus: FinancePaymentStatus;
  transactionDate: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransactionInput {
  type: FinanceTransactionType;
  amountCents: number;
  category: string;
  description: string;
  counterparty: string;
  reference: string;
  vatRate: FinanceVatRate;
  vatAmountCents: number;
  paymentStatus: FinancePaymentStatus;
  transactionDate: string;
  dueDate: string | null;
}

export type FinanceTransactionPatch = Partial<FinanceTransactionInput>;

const selection = {
  ...getTableColumns(financeTransaction),
  createdByName: user.name,
};

function mapFinanceTransaction(row: FinanceTransactionSelect): FinanceTransactionRow {
  return {
    ...row,
    type: row.type as FinanceTransactionType,
    amountCents: num(row.amountCents),
    vatRate: row.vatRate as FinanceVatRate,
    vatAmountCents: num(row.vatAmountCents),
    paymentStatus: row.paymentStatus as FinancePaymentStatus,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listFinanceTransactions(projectId: number): Promise<FinanceTransactionRow[]> {
  const rows = await db
    .select(selection)
    .from(financeTransaction)
    .leftJoin(user, eq(user.id, financeTransaction.createdByUserId))
    .where(eq(financeTransaction.projectId, projectId))
    .orderBy(desc(financeTransaction.transactionDate), desc(financeTransaction.id));
  return rows.map(mapFinanceTransaction);
}

export async function getFinanceTransactionByPublicId(
  publicId: string,
): Promise<FinanceTransactionRow | null> {
  const [row] = await db
    .select(selection)
    .from(financeTransaction)
    .leftJoin(user, eq(user.id, financeTransaction.createdByUserId))
    .where(eq(financeTransaction.publicId, publicId));
  return row ? mapFinanceTransaction(row) : null;
}

export async function getFinanceTransactionProjectId(publicId: string): Promise<number | null> {
  const [row] = await db
    .select({ projectId: financeTransaction.projectId })
    .from(financeTransaction)
    .where(eq(financeTransaction.publicId, publicId));
  return row?.projectId ?? null;
}

export async function createFinanceTransaction(
  projectId: number,
  createdByUserId: string,
  input: FinanceTransactionInput,
): Promise<FinanceTransactionRow> {
  const [created] = await db
    .insert(financeTransaction)
    .values({ projectId, createdByUserId, ...input })
    .returning({ publicId: financeTransaction.publicId });
  const row = await getFinanceTransactionByPublicId(created.publicId);
  if (!row) throw new Error('Created finance transaction could not be loaded');
  return row;
}

export async function updateFinanceTransaction(
  publicId: string,
  patch: FinanceTransactionPatch,
): Promise<FinanceTransactionRow | null> {
  const [updated] = await db
    .update(financeTransaction)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(financeTransaction.publicId, publicId))
    .returning({ publicId: financeTransaction.publicId });
  return updated ? getFinanceTransactionByPublicId(updated.publicId) : null;
}

export async function deleteFinanceTransaction(publicId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(financeTransaction)
    .where(eq(financeTransaction.publicId, publicId))
    .returning({ id: financeTransaction.id });
  return Boolean(deleted);
}
