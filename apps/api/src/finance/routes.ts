import { Elysia, t } from 'elysia';
import { requireUser } from '../shared/access';
import { authContext } from '../shared/auth-context';
import { entityGuard, guards } from '../shared/guards';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  getFinanceTransactionByPublicId,
  getFinanceTransactionProjectId,
  listFinanceTransactions,
  updateFinanceTransaction,
  type FinancePaymentStatus,
  type FinanceTransactionInput,
  type FinanceTransactionPatch,
  type FinanceTransactionRow,
  type FinanceTransactionType,
  type FinanceVatRate,
} from './store';

const TransactionType = t.UnionEnum(['income', 'expense']);
const PaymentStatus = t.UnionEnum(['open', 'paid']);
const VatRate = t.Union([t.Literal(0), t.Literal(9), t.Literal(21)]);
const AmountCents = t.Integer({ minimum: 1, maximum: 9_000_000_000_000 });
const ShortText = t.String({ maxLength: 200 });
const TransactionParams = t.Object({
  transactionId: t.String({ format: 'uuid' }),
});

const FinanceTransactionResponse = t.Object({
  id: t.String(),
  type: TransactionType,
  amountCents: t.Number(),
  category: t.String(),
  description: t.String(),
  counterparty: t.String(),
  reference: t.String(),
  vatRate: VatRate,
  vatAmountCents: t.Number(),
  paymentStatus: PaymentStatus,
  transactionDate: t.String(),
  dueDate: t.Nullable(t.String()),
  createdByName: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const CreateFinanceTransactionBody = t.Object({
  type: TransactionType,
  amountCents: AmountCents,
  category: t.String({ minLength: 1, maxLength: 200 }),
  description: ShortText,
  counterparty: t.Optional(ShortText),
  reference: t.Optional(t.String({ maxLength: 100 })),
  vatRate: t.Optional(VatRate),
  paymentStatus: t.Optional(PaymentStatus),
  transactionDate: t.String({ format: 'date' }),
  dueDate: t.Optional(t.Nullable(t.String({ format: 'date' }))),
});

interface FinanceTransactionRequest {
  type: FinanceTransactionType;
  amountCents: number;
  category: string;
  description: string;
  counterparty?: string;
  reference?: string;
  vatRate?: FinanceVatRate;
  paymentStatus?: FinancePaymentStatus;
  transactionDate: string;
  dueDate?: string | null;
}

function financeTransactionDto(row: FinanceTransactionRow) {
  return {
    id: row.publicId,
    type: row.type,
    amountCents: row.amountCents,
    category: row.category,
    description: row.description,
    counterparty: row.counterparty,
    reference: row.reference,
    vatRate: row.vatRate,
    vatAmountCents: row.vatAmountCents,
    paymentStatus: row.paymentStatus,
    transactionDate: row.transactionDate,
    dueDate: row.dueDate,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function vatFromGross(amountCents: number, vatRate: FinanceVatRate): number {
  return Math.round((amountCents * vatRate) / (100 + vatRate));
}

function cleanTransaction(input: FinanceTransactionRequest): FinanceTransactionInput {
  const vatRate = input.vatRate ?? 0;
  return {
    ...input,
    category: input.category.trim(),
    description: input.description.trim(),
    counterparty: input.counterparty?.trim() ?? '',
    reference: input.reference?.trim() ?? '',
    vatRate,
    vatAmountCents: vatFromGross(input.amountCents, vatRate),
    paymentStatus: input.paymentStatus ?? 'paid',
    dueDate: input.dueDate ?? null,
  };
}

function cleanPatch(input: Partial<FinanceTransactionRequest>): Partial<FinanceTransactionRequest> {
  const cleaned = { ...input };
  if (cleaned.category !== undefined) cleaned.category = cleaned.category.trim();
  if (cleaned.description !== undefined) cleaned.description = cleaned.description.trim();
  if (cleaned.counterparty !== undefined) cleaned.counterparty = cleaned.counterparty.trim();
  if (cleaned.reference !== undefined) cleaned.reference = cleaned.reference.trim();
  return cleaned;
}

function assertCategory(category: string | undefined): void {
  if (category !== undefined && !category) throw new HttpError(400, 'Category is required');
}

export const financeRoutes = new Elysia({
  name: 'finance',
  detail: { tags: ['Finance'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    financeTransaction: entityGuard('finance', 'Transaction not found', (params) =>
      getFinanceTransactionProjectId(params.transactionId),
    ),
  })
  .get(
    '/projects/:projectKey/finance/transactions',
    async ({ project }) => (await listFinanceTransactions(project.id)).map(financeTransactionDto),
    {
      permission: ['finance', 'read'],
      response: {
        200: t.Array(FinanceTransactionResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's finance transactions" },
    },
  )
  .post(
    '/projects/:projectKey/finance/transactions',
    async ({ project, user, body, set }) => {
      const input = cleanTransaction(body);
      assertCategory(input.category);
      const row = await createFinanceTransaction(project.id, requireUser(user).id, input);
      set.status = 201;
      return financeTransactionDto(row);
    },
    {
      permission: ['finance', 'create'],
      body: CreateFinanceTransactionBody,
      response: {
        201: FinanceTransactionResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Create a finance transaction' },
    },
  )
  .patch(
    '/finance/transactions/:transactionId',
    async ({ params, body }) => {
      const cleaned = cleanPatch(body);
      assertCategory(cleaned.category);
      const current = await getFinanceTransactionByPublicId(params.transactionId);
      if (!current) throw new HttpError(404, 'Transaction not found');
      const amountCents = cleaned.amountCents ?? current.amountCents;
      const vatRate = cleaned.vatRate ?? current.vatRate;
      const patch: FinanceTransactionPatch = {
        ...cleaned,
        vatAmountCents: vatFromGross(amountCents, vatRate),
      };
      const row = await updateFinanceTransaction(params.transactionId, patch);
      if (!row) throw new HttpError(404, 'Transaction not found');
      return financeTransactionDto(row);
    },
    {
      financeTransaction: 'edit',
      params: TransactionParams,
      body: t.Object({
        type: t.Optional(TransactionType),
        amountCents: t.Optional(AmountCents),
        category: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(ShortText),
        counterparty: t.Optional(ShortText),
        reference: t.Optional(t.String({ maxLength: 100 })),
        vatRate: t.Optional(VatRate),
        paymentStatus: t.Optional(PaymentStatus),
        transactionDate: t.Optional(t.String({ format: 'date' })),
        dueDate: t.Optional(t.Nullable(t.String({ format: 'date' }))),
      }),
      response: {
        200: FinanceTransactionResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a finance transaction' },
    },
  )
  .delete(
    '/finance/transactions/:transactionId',
    async ({ params }) => {
      if (!(await deleteFinanceTransaction(params.transactionId))) {
        throw new HttpError(404, 'Transaction not found');
      }
      return noContent();
    },
    {
      financeTransaction: 'delete',
      params: TransactionParams,
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a finance transaction' },
    },
  );
