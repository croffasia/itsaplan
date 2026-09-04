import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const smtp = {
  enabled: true,
  host: 'smtp.example.com',
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
      smtp: { ...smtp, host: ' smtp.example.com ' },
    });

    expect(res.status).toBe(200);
    expect(res.data?.smtp).toMatchObject({ enabled: true, host: 'smtp.example.com' });
  });
});
