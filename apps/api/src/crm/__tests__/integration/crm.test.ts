import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

const companyX = {
  name: 'Company X',
  status: 'active' as const,
  service: 'Website',
  owner: 'Danil',
  contactName: 'Alex Example',
  contactEmail: 'alex@example.com',
  contactPhone: '+31 6 12345678',
  projectStatus: 'Feedback round',
  openTasks: 'Process feedback\nPublish website',
  notes: 'Prefers communication by email.',
  lastCommunication: 'Feedback received by email.',
  nextAction: 'Process feedback',
  deadline: '2026-08-08',
};

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

describe('CRM', () => {
  beforeEach(resetDb);

  it('creates, lists, reads, updates, and deletes a customer', async () => {
    const { asOwner } = await setupProject();

    const created = await asOwner.projects({ projectKey: 'MKT' }).crm.customers.post(companyX);
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      name: 'Company X',
      status: 'active',
      service: 'Website',
      owner: 'Danil',
      nextAction: 'Process feedback',
    });

    const customerId = created.data!.id;
    const list = await asOwner.projects({ projectKey: 'MKT' }).crm.customers.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const detail = await asOwner.crm.customers({ customerId }).get();
    expect(detail.status).toBe(200);
    expect(detail.data).toMatchObject({ contactEmail: 'alex@example.com' });

    const updated = await asOwner.crm.customers({ customerId }).patch({
      status: 'inactive',
      nextAction: 'Archive account',
      deadline: null,
    });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({
      status: 'inactive',
      nextAction: 'Archive account',
      deadline: null,
    });

    expect((await asOwner.crm.customers({ customerId }).delete()).status).toBe(204);
    expect((await asOwner.crm.customers({ customerId }).get()).status).toBe(404);
  });

  it('rejects a company name that contains only whitespace', async () => {
    const { asOwner } = await setupProject();
    const result = await asOwner.projects({ projectKey: 'MKT' }).crm.customers.post({
      ...companyX,
      name: '   ',
    });
    expect(result.status).toBe(400);
  });

  it('denies a non-member access to customer data', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'MKT' }).crm.customers.post(companyX);
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await outsider.projects({ projectKey: 'MKT' }).crm.customers.get()).status).toBe(403);
    expect((await outsider.crm.customers({ customerId: created.data!.id }).get()).status).toBe(403);
  });

  it('returns 404 for an unknown customer', async () => {
    const { asOwner } = await setupProject();
    const customerId = '00000000-0000-0000-0000-000000000000';
    expect((await asOwner.crm.customers({ customerId }).get()).status).toBe(404);
    expect((await asOwner.crm.customers({ customerId }).delete()).status).toBe(404);
  });

  it('rejects an invalid customer id before querying PostgreSQL', async () => {
    const { asOwner } = await setupProject();
    const result = await asOwner.crm.customers({ customerId: 'not-a-uuid' }).get();
    expect(result.status).toBe(400);
  });
});
