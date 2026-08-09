import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

describe('mailbox', () => {
  beforeEach(resetDb);

  it('returns secure Zoho defaults without exposing a secret', async () => {
    const { asOwner } = await setupProject();
    const result = await asOwner.projects({ projectKey: 'MKT' }).mailbox.settings.get();

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      connected: false,
      hasPassword: false,
      imapHost: 'imappro.zoho.com',
      smtpHost: 'smtppro.zoho.com',
      smtpPort: 465,
      smtpSecurity: 'ssl',
    });
    expect(result.data).not.toHaveProperty('password');
  });

  it('rejects an arbitrary mail host before making a network connection', async () => {
    const { asOwner } = await setupProject();
    const result = await asOwner.projects({ projectKey: 'MKT' }).mailbox.settings.put({
      email: 'owner@example.com',
      username: 'owner@example.com',
      password: 'secret',
      imapHost: '127.0.0.1',
      smtpHost: 'smtppro.zoho.com',
      smtpPort: 465,
      smtpSecurity: 'ssl',
    });

    expect(result.status).toBe(400);
  });

  it('requires a connected mailbox before reading or sending mail', async () => {
    const { asOwner } = await setupProject();
    expect((await asOwner.projects({ projectKey: 'MKT' }).mailbox.messages.get()).status).toBe(409);
    expect(
      (
        await asOwner.projects({ projectKey: 'MKT' }).mailbox.messages.post({
          to: ['client@example.com'],
          subject: 'Hello',
          body: 'Test message',
        })
      ).status,
    ).toBe(409);
  });

  it('denies mailbox settings to a non-member', async () => {
    const { asOwner } = await setupProject();
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await outsider.projects({ projectKey: 'MKT' }).mailbox.settings.get()).status).toBe(
      403,
    );
    expect((await asOwner.projects({ projectKey: 'MKT' }).mailbox.settings.delete()).status).toBe(
      204,
    );
  });
});
