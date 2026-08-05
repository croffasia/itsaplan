import { beforeEach, describe, expect, it } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

function upload(client: ReturnType<typeof authedApi>, name = 'plan.txt', content = 'hello') {
  const file = new File([content], name, { type: 'text/plain' });
  return client.projects({ projectKey: 'MKT' }).files.post({ file });
}

describe('files', () => {
  beforeEach(resetDb);

  it('uploads, lists, downloads, and deletes a project file', async () => {
    const { asOwner } = await setupProject();
    const uploaded = await upload(asOwner);
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({ filename: 'plan.txt', sizeBytes: 5 });

    const list = await asOwner.projects({ projectKey: 'MKT' }).files.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);
    expect(list.data?.[0].uploadedByName).toBeTruthy();

    const publicId = uploaded.data!.id;
    const raw = await asOwner.files({ publicId }).raw.get();
    expect(raw.status).toBe(200);
    expect(String(raw.data)).toBe('hello');
    expect(raw.response.headers.get('content-disposition')).toContain('attachment');
    expect(raw.response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(raw.response.headers.get('content-security-policy')).toContain('sandbox');
    expect(raw.response.headers.get('cache-control')).toContain('no-store');

    expect((await asOwner.files({ publicId }).delete()).status).toBe(204);
    expect((await asOwner.files({ publicId }).raw.get()).status).toBe(404);
  });

  it('rejects an empty file', async () => {
    const { asOwner } = await setupProject();
    const result = await asOwner.projects({ projectKey: 'MKT' }).files.post({
      file: new File([], 'empty.txt', { type: 'text/plain' }),
    });
    expect(result.status).toBe(400);
  });

  it('associates an uploaded file with a CRM customer in the same project', async () => {
    const { asOwner } = await setupProject();
    const customer = await asOwner.projects({ projectKey: 'MKT' }).crm.customers.post({
      name: 'Company X',
      status: 'active',
      service: 'Website',
      owner: 'Danil',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      projectStatus: '',
      openTasks: '',
      notes: '',
      lastCommunication: '',
      nextAction: 'Process feedback',
      deadline: null,
    });

    const uploaded = await asOwner
      .projects({ projectKey: 'MKT' })
      .crm.customers({ customerId: customer.data!.id })
      .files.post({ file: new File(['brief'], 'brief.pdf', { type: 'application/pdf' }) });
    expect(uploaded.status).toBe(201);
    expect(uploaded.data?.customerId).toBe(customer.data!.id);

    const list = await asOwner.projects({ projectKey: 'MKT' }).files.get();
    expect(list.data?.[0].customerId).toBe(customer.data!.id);
  });

  it('requires both Files create and CRM edit to link a customer file', async () => {
    const { asOwner } = await setupProject();
    const customer = await asOwner.projects({ projectKey: 'MKT' }).crm.customers.post({
      name: 'Company X',
      status: 'active',
      service: '',
      owner: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      projectStatus: '',
      openTasks: '',
      notes: '',
      lastCommunication: '',
      nextAction: '',
      deadline: null,
    });
    const member = await signUpTestUser();
    const role = await asOwner
      .projects({ projectKey: 'MKT' })
      .roles.post({ name: 'File uploader', permissions: { files: { create: true } } });
    const invite = await asOwner.projects({ projectKey: 'MKT' }).invites.post({
      email: member.email,
      role: 'member',
      roleId: role.data!.id,
    });
    const asMember = authedApi(member.cookie);
    await asMember.invites({ token: invite.data!.token }).accept.post();

    const result = await asMember
      .projects({ projectKey: 'MKT' })
      .crm.customers({ customerId: customer.data!.id })
      .files.post({ file: new File(['brief'], 'brief.pdf', { type: 'application/pdf' }) });
    expect(result.status).toBe(403);
  });

  it('requires authentication to download a file', async () => {
    const { asOwner } = await setupProject();
    const uploaded = await upload(asOwner);
    expect((await api.files({ publicId: uploaded.data!.id }).raw.get()).status).toBe(401);
  });

  it('denies a non-member listing and downloading project files', async () => {
    const { asOwner } = await setupProject();
    const uploaded = await upload(asOwner);
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await outsider.projects({ projectKey: 'MKT' }).files.get()).status).toBe(403);
    expect((await outsider.files({ publicId: uploaded.data!.id }).raw.get()).status).toBe(403);
  });

  it('returns 404 for an unknown file', async () => {
    const { asOwner } = await setupProject();
    const missing = '00000000-0000-0000-0000-000000000000';
    expect((await asOwner.files({ publicId: missing }).raw.get()).status).toBe(404);
    expect((await asOwner.files({ publicId: missing }).delete()).status).toBe(404);
  });
});
