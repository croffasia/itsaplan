import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
  return { asOwner };
}

const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

describe('Command center', () => {
  beforeEach(async () => {
    await resetDb();
  }, 30_000);

  it('reports nothing on a project where nothing is wrong', async () => {
    const { asOwner } = await setupProject();

    const response = await asOwner.projects({ projectKey: 'OPS' })['command-center'].get();
    expect(response.status).toBe(200);
    expect(response.data!.signals).toEqual([]);
    expect(response.data!.focusId).toBeNull();
  });

  it('raises a signal for an overdue invoice and points at where to act', async () => {
    const { asOwner } = await setupProject();

    await asOwner.projects({ projectKey: 'OPS' }).finance.transactions.post({
      type: 'income',
      amountCents: 250_00,
      category: 'sales',
      description: 'Website build',
      paymentStatus: 'open',
      transactionDate: yesterday(),
      dueDate: yesterday(),
    });

    const response = await asOwner.projects({ projectKey: 'OPS' })['command-center'].get();
    const invoices = response.data!.signals.find((s) => s.id === 'finance.invoices_overdue');
    expect(invoices).toMatchObject({ severity: 'critical', count: 1 });
    expect(invoices!.detail).toContain('€250');
    expect(invoices!.href).toBe('/project/OPS/finance');
    // The loudest open signal is what the page opens on.
    expect(response.data!.focusId).toBe('finance.invoices_overdue');
  });

  it('hides a snoozed signal from the focus but keeps it listed', async () => {
    const { asOwner } = await setupProject();
    await asOwner.projects({ projectKey: 'OPS' }).finance.transactions.post({
      type: 'income',
      amountCents: 100_00,
      category: 'sales',
      description: 'Retainer',
      paymentStatus: 'open',
      transactionDate: yesterday(),
      dueDate: yesterday(),
    });

    const snoozed = await asOwner
      .projects({ projectKey: 'OPS' })
      ['command-center']({ signalId: 'finance.invoices_overdue' })
      .snooze.post({ hours: 24 });
    expect(snoozed.status).toBe(204);

    const after = await asOwner.projects({ projectKey: 'OPS' })['command-center'].get();
    expect(after.data!.focusId).toBeNull();
    expect(after.data!.signals[0]!.snoozedUntil).not.toBeNull();

    const restored = await asOwner
      .projects({ projectKey: 'OPS' })
      ['command-center']({ signalId: 'finance.invoices_overdue' })
      .snooze.delete();
    expect(restored.status).toBe(204);

    const back = await asOwner.projects({ projectKey: 'OPS' })['command-center'].get();
    expect(back.data!.focusId).toBe('finance.invoices_overdue');
  });

  it('refuses a snooze longer than a week', async () => {
    const { asOwner } = await setupProject();
    const response = await asOwner
      .projects({ projectKey: 'OPS' })
      ['command-center']({ signalId: 'finance.invoices_overdue' })
      .snooze.post({ hours: 24 * 30 });
    expect(response.status).toBe(400);
  });

  it('keeps the page inside the project', async () => {
    await setupProject();
    const outsider = await signUpTestUser();

    const response = await authedApi(outsider.cookie)
      .projects({ projectKey: 'OPS' })
      ['command-center'].get();
    expect(response.status).toBe(403);
  });
});
