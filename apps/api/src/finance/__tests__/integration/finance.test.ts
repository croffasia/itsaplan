import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

const websiteIncome = {
  type: 'income' as const,
  amountCents: 250_000,
  category: 'Sales',
  description: 'Website project',
  transactionDate: '2026-08-08',
};

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

describe('Finance', () => {
  beforeEach(resetDb);

  it('creates, lists, updates, and deletes a transaction', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .finance.transactions.post(websiteIncome);

    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      ...websiteIncome,
      transactionDate: new Date('2026-08-08T00:00:00.000Z'),
    });
    expect(created.data?.createdByName).toBeTruthy();

    const transactionId = created.data!.id;
    const list = await asOwner.projects({ projectKey: 'MKT' }).finance.transactions.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const updated = await asOwner.finance.transactions({ transactionId }).patch({
      amountCents: 275_000,
      description: 'Website project final invoice',
    });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({ amountCents: 275_000 });

    expect((await asOwner.finance.transactions({ transactionId }).delete()).status).toBe(204);
    expect((await asOwner.projects({ projectKey: 'MKT' }).finance.transactions.get()).data).toEqual(
      [],
    );
  });

  it('rejects invalid amounts and whitespace-only categories', async () => {
    const { asOwner } = await setupProject();
    const invalidAmount = await asOwner.projects({ projectKey: 'MKT' }).finance.transactions.post({
      ...websiteIncome,
      amountCents: 0,
    });
    expect(invalidAmount.status).toBe(400);

    const invalidCategory = await asOwner
      .projects({
        projectKey: 'MKT',
      })
      .finance.transactions.post({ ...websiteIncome, category: '   ' });
    expect(invalidCategory.status).toBe(400);
  });

  it('stores accounting details and recalculates VAT after an amount change', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'MKT' }).finance.transactions.post({
      ...websiteIncome,
      amountCents: 12_100,
      counterparty: 'Bedrijf X',
      reference: 'INV-2026-001',
      vatRate: 21,
      paymentStatus: 'open',
      dueDate: '2026-08-31',
    });

    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      counterparty: 'Bedrijf X',
      reference: 'INV-2026-001',
      vatRate: 21,
      vatAmountCents: 2_100,
      paymentStatus: 'open',
      dueDate: new Date('2026-08-31T00:00:00.000Z'),
    });

    const updated = await asOwner.finance.transactions({ transactionId: created.data!.id }).patch({
      amountCents: 24_200,
    });
    expect(updated.status).toBe(200);
    expect(updated.data?.vatAmountCents).toBe(4_200);
  });

  it('denies a non-member access to financial data', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .finance.transactions.post(websiteIncome);
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await outsider.projects({ projectKey: 'MKT' }).finance.transactions.get()).status).toBe(
      403,
    );
    expect(
      (
        await outsider.finance
          .transactions({ transactionId: created.data!.id })
          .patch({ amountCents: 1 })
      ).status,
    ).toBe(403);
  });

  it('rejects an invalid transaction id before querying PostgreSQL', async () => {
    const { asOwner } = await setupProject();
    const result = await asOwner.finance.transactions({ transactionId: 'not-a-uuid' }).delete();
    expect(result.status).toBe(400);
  });
});
