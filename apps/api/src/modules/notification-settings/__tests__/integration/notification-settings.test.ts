import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The SMTP host is resolved when saved, so the fixture is a name that resolves to
// a public address.
const smtp = {
  enabled: true,
  host: 'example.com',
  port: 587,
  encryption: 'none' as const,
  username: '',
  timeout: null,
};

async function ownedTeam(): Promise<{ api: Api; teamId: number }> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const teams = await api.teams.get();
  return { api, teamId: teams.data![0].id };
}

describe('notification settings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('defaults SMTP encryption to STARTTLS', async () => {
    const { api, teamId } = await ownedTeam();

    const res = await api.teams({ teamId })['notification-settings'].get();

    expect(res.status).toBe(200);
    expect(res.data?.smtp).toMatchObject({ encryption: 'tls', port: 587 });
  });

  it('rejects SMTP without a host', async () => {
    const { api, teamId } = await ownedTeam();

    const res = await api
      .teams({ teamId })
      ['notification-settings'].put({ smtp: { ...smtp, host: '  ' } });

    expect(res.status).toBe(400);
  });

  it('rejects SMTP with a username but no password', async () => {
    const { api, teamId } = await ownedTeam();

    const res = await api
      .teams({ teamId })
      ['notification-settings'].put({ smtp: { ...smtp, username: 'mailer@example.com' } });

    expect(res.status).toBe(400);
  });

  it('rejects Resend without an API key', async () => {
    const { api, teamId } = await ownedTeam();

    const res = await api.teams({ teamId })['notification-settings'].put({
      resend: { enabled: true },
    });

    expect(res.status).toBe(400);
  });

  it('saves Resend without vetting an SMTP host', async () => {
    const { api, teamId } = await ownedTeam();

    const res = await api.teams({ teamId })['notification-settings'].put({
      resend: { enabled: true, apiKey: 're_test_key' },
    });

    expect(res.status).toBe(200);
    expect(res.data?.resend).toMatchObject({ enabled: true, hasApiKey: true });
  });

  it('keeps the stored password when the field is left blank', async () => {
    const { api, teamId } = await ownedTeam();
    const credentials = { ...smtp, username: 'mailer@example.com', password: 'secret' };

    const saved = await api.teams({ teamId })['notification-settings'].put({ smtp: credentials });
    expect(saved.status).toBe(200);
    expect(saved.data?.smtp.hasPassword).toBe(true);

    const again = await api
      .teams({ teamId })
      ['notification-settings'].put({ smtp: { ...credentials, password: '' } });

    expect(again.status).toBe(200);
    expect(again.data?.smtp.hasPassword).toBe(true);
  });

  it('stores a provider that can send', async () => {
    const { api, teamId } = await ownedTeam();

    const res = await api.teams({ teamId })['notification-settings'].put({
      smtp: { ...smtp, host: ' example.com ' },
    });

    expect(res.status).toBe(200);
    expect(res.data?.smtp).toMatchObject({ enabled: true, host: 'example.com' });
  });

  describe('SMTP host', () => {
    const saved = process.env.SSRF_ALLOWED_HOSTS;
    afterEach(() => {
      if (saved === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
      else process.env.SSRF_ALLOWED_HOSTS = saved;
    });

    for (const host of ['127.0.0.1', '10.0.0.1', '169.254.169.254', 'localhost']) {
      it(`rejects ${host}`, async () => {
        const { api, teamId } = await ownedTeam();

        const res = await api
          .teams({ teamId })
          ['notification-settings'].put({ smtp: { ...smtp, host } });

        expect(res.status).toBe(400);
        expect(res.error?.value).toMatchObject({
          error: 'SMTP host must not point to a private or local address',
        });
      });
    }

    it('rejects a hostname that resolves to a private address', async () => {
      const { api, teamId } = await ownedTeam();

      const res = await api
        .teams({ teamId })
        ['notification-settings'].put({ smtp: { ...smtp, host: 'localtest.me' } });

      expect(res.status).toBe(400);
    });

    it('rejects a hostname that does not resolve', async () => {
      const { api, teamId } = await ownedTeam();

      const res = await api
        .teams({ teamId })
        ['notification-settings'].put({ smtp: { ...smtp, host: 'smtp.invalid' } });

      expect(res.status).toBe(400);
      expect(res.error?.value).toMatchObject({ error: 'SMTP host could not be resolved' });
    });

    it('accepts a private host named in SSRF_ALLOWED_HOSTS', async () => {
      process.env.SSRF_ALLOWED_HOSTS = '10.0.0.1';
      const { api, teamId } = await ownedTeam();

      const res = await api
        .teams({ teamId })
        ['notification-settings'].put({ smtp: { ...smtp, host: '10.0.0.1' } });

      expect(res.status).toBe(200);
      expect(res.data?.smtp.host).toBe('10.0.0.1');
    });

    it('does not vet the host of a disabled SMTP section', async () => {
      const { api, teamId } = await ownedTeam();

      const res = await api
        .teams({ teamId })
        ['notification-settings'].put({ smtp: { ...smtp, enabled: false, host: '10.0.0.1' } });

      expect(res.status).toBe(200);
    });
  });

  describe('SMTP port and timeout', () => {
    for (const port of [0, 70000]) {
      it(`rejects port ${port}`, async () => {
        const { api, teamId } = await ownedTeam();

        const res = await api
          .teams({ teamId })
          ['notification-settings'].put({ smtp: { ...smtp, port } });

        expect(res.status).toBe(400);
      });
    }

    it('rejects a timeout above 60 seconds', async () => {
      const { api, teamId } = await ownedTeam();

      const res = await api
        .teams({ teamId })
        ['notification-settings'].put({ smtp: { ...smtp, timeout: 61 } });

      expect(res.status).toBe(400);
    });

    it('accepts a timeout of 60 seconds', async () => {
      const { api, teamId } = await ownedTeam();

      const res = await api
        .teams({ teamId })
        ['notification-settings'].put({ smtp: { ...smtp, timeout: 60 } });

      expect(res.status).toBe(200);
      expect(res.data?.smtp.timeout).toBe(60);
    });
  });
});
