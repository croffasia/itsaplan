import { beforeEach, describe, expect, it } from 'bun:test';
import { auth, setAuthSettings } from '@repo/auth';
import { authedApi } from '#tests/helpers/app';
import { openMagicLink, signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The allowed email domains of the instance: a new account's address must be at one of
// them, on every way in, and an address that could not register takes no invite.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  await setAuthSettings({ allowedEmailDomains: ['company.com'] });
  return { asOwner };
}

const signUp = (email: string) =>
  auth.api.signUpEmail({
    body: { email, password: 'test-password-123', name: 'Newcomer' },
    asResponse: true,
  });

async function refusalCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    return (err as { body?: { code?: string } }).body?.code ?? 'unknown';
  }
}

describe('allowed email domains', () => {
  beforeEach(resetDb);

  it('admits an address at a listed domain, in any case', async () => {
    await setup();
    expect((await signUp('Newcomer@Company.COM')).status).toBe(200);
  });

  it('refuses the email form for an address at another domain', async () => {
    await setup();
    expect(await refusalCode(signUp('newcomer@company.com.evil.io'))).toBe(
      'EMAIL_DOMAIN_NOT_ALLOWED',
    );
    expect(await refusalCode(signUp('newcomer@eu.company.com'))).toBe('EMAIL_DOMAIN_NOT_ALLOWED');
  });

  it('refuses a magic link for an address at another domain', async () => {
    await setup();
    const location = await openMagicLink('newcomer@gmail.com', 'magic-outside');
    expect(location.searchParams.get('error')).toBe('EMAIL_DOMAIN_NOT_ALLOWED');
  });

  it('refuses to invite an address with no account at another domain', async () => {
    const { asOwner } = await setup();
    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: 'newcomer@gmail.com', role: 'member' });
    expect(res.status).toBe(400);
    expect((res.error?.value as { code?: string }).code).toBe('EMAIL_DOMAIN_NOT_ALLOWED');
  });

  it('invites an account that already exists at another domain', async () => {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
    await signUpTestUser({ email: 'earlier@gmail.com' });
    await setAuthSettings({ allowedEmailDomains: ['company.com'] });
    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: 'earlier@gmail.com', role: 'member' });
    expect(res.status).toBe(201);
  });

  it('saves only lowercase domains in god mode', async () => {
    const { asOwner } = await setup();
    const settings = asOwner.god['auth-settings'];
    expect((await settings.put({ allowedEmailDomains: ['Company.com'] })).status).toBe(400);
    expect((await settings.put({ allowedEmailDomains: ['not a domain'] })).status).toBe(400);
    const saved = await settings.put({ allowedEmailDomains: ['company.com', 'company.io'] });
    expect(saved.data?.allowedEmailDomains).toEqual(['company.com', 'company.io']);
  });
});
