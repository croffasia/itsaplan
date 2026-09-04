import { beforeEach, describe, expect, it } from 'bun:test';
import { getEmailConfig, resolveEmailConfig, setEmailSettings } from '@repo/auth';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

describe('god email settings', () => {
  beforeEach(resetDb);

  it('refuses a test from a plain user', async () => {
    await setup();
    const user = await addUser({ email: 'member@example.com' });

    const res = await user.api.god['email-settings'].test.post();

    expect(res.status).toBe(403);
  });

  it('refuses a test until a provider is configured', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-settings'].test.post();

    expect(res.status).toBe(400);
    expect(res.error!.value).toMatchObject({ error: 'Configure an email provider first' });
  });

  it('tests draft provider settings without persisting them', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-settings'].test.post({
      smtp: {
        enabled: true,
        host: '127.0.0.1',
        port: 1,
        encryption: 'none',
        username: '',
        timeout: 1,
      },
      resend: { enabled: false },
      from: 'noreply@example.com',
    });

    // Port 1 is deliberately unreachable. Reaching the transport proves the draft
    // was used instead of being rejected as an unconfigured saved provider.
    expect(res.status).toBe(502);
    expect(await getEmailConfig()).toBeNull();
  });

  it('reuses a saved secret while resolving a draft without changing storage', async () => {
    await setup();
    await setEmailSettings({
      smtp: {
        enabled: true,
        host: 'smtp.saved.example',
        port: 587,
        encryption: 'tls',
        username: 'saved@example.com',
        password: 'stored-secret',
        timeout: 10,
      },
      resend: { enabled: false },
      from: 'saved@example.com',
    });

    const draft = await resolveEmailConfig({
      smtp: {
        enabled: true,
        host: 'smtp.draft.example',
        port: 465,
        encryption: 'ssl',
        username: 'draft@example.com',
        timeout: 5,
      },
      from: 'draft@example.com',
    });

    expect(draft.smtp).toMatchObject({
      host: 'smtp.draft.example',
      username: 'draft@example.com',
      password: 'stored-secret',
    });
    expect(await getEmailConfig()).toMatchObject({
      smtp: { host: 'smtp.saved.example', password: 'stored-secret' },
      from: 'saved@example.com',
    });
  });
});
