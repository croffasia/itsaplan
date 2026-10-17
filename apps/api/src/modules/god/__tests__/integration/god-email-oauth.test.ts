import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { resolveEmailConfig } from '@repo/auth';
import { sendEmail, type EmailConfig } from '@repo/mailer';
import { resetDb } from '#tests/helpers/db';
import { setup } from '../helpers';

// A Microsoft 365 mailbox with MFA only accepts an app registration's OAuth token over
// SMTP (XOAUTH2). The token is asked of Microsoft with the client credentials, reused
// while it lasts, and presented to the server in place of a password.
const realFetch = globalThis.fetch;
let tokenRequests: { url: string; body: URLSearchParams }[] = [];
let tokenResponse: () => Response = () =>
  Response.json({ access_token: 'token-1', expires_in: 3600 });

beforeEach(() => {
  tokenRequests = [];
  authLines = [];
  tokenResponse = () => Response.json({ access_token: 'token-1', expires_in: 3600 });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith('https://login.microsoftonline.com/')) return realFetch(input, init);
    tokenRequests.push({ url, body: new URLSearchParams(String(init?.body)) });
    return tokenResponse();
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

// Just enough SMTP to accept one message, recording the AUTH line it receives.
let smtpServer: Bun.TCPSocketListener<{ data: boolean }>;
let authLines: string[] = [];

beforeAll(() => {
  smtpServer = Bun.listen<{ data: boolean }>({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(socket) {
        socket.data = { data: false };
        socket.write('220 fake ESMTP\r\n');
      },
      data(socket, chunk) {
        for (const line of chunk.toString().split('\r\n').filter(Boolean)) {
          if (socket.data.data) {
            if (line === '.') {
              socket.data.data = false;
              socket.write('250 queued\r\n');
            }
            continue;
          }
          const command = line.split(' ')[0]!.toUpperCase();
          if (command === 'EHLO') socket.write('250-fake\r\n250 AUTH XOAUTH2\r\n');
          else if (command === 'AUTH') {
            authLines.push(line);
            socket.write('235 accepted\r\n');
          } else if (command === 'DATA') {
            socket.data.data = true;
            socket.write('354 go ahead\r\n');
          } else if (command === 'QUIT') {
            socket.write('221 bye\r\n');
            socket.end();
          } else socket.write('250 ok\r\n');
        }
      },
    },
  });
});

afterAll(() => smtpServer.stop(true));

function microsoftConfig(clientId: string, port: number): EmailConfig {
  return {
    smtp: {
      enabled: true,
      host: '127.0.0.1',
      port,
      encryption: 'none',
      username: 'mailer@example.com',
      password: '',
      timeout: 5,
      auth: 'microsoft365',
      oauth: { tenantId: 'tenant-1', clientId, clientSecret: 'app-secret' },
    },
    resend: { enabled: false, apiKey: '' },
    from: 'mailer@example.com',
  };
}

const message = { to: 'someone@example.org', subject: 'Hi', text: 'Hi', html: '<p>Hi</p>' };

describe('SMTP through Microsoft 365 OAuth', () => {
  it('presents the app token to the server instead of a password', async () => {
    const result = await sendEmail(microsoftConfig('client-send', smtpServer.port), message);

    expect(result).toEqual({ ok: true });
    expect(tokenRequests).toHaveLength(1);
    expect(tokenRequests[0]!.url).toBe(
      'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token',
    );
    expect(Object.fromEntries(tokenRequests[0]!.body)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'client-send',
      client_secret: 'app-secret',
      scope: 'https://outlook.office365.com/.default',
    });
    const [, mechanism, payload] = authLines[0]!.split(' ');
    expect(mechanism).toBe('XOAUTH2');
    expect(Buffer.from(payload!, 'base64').toString()).toBe(
      'user=mailer@example.com\x01auth=Bearer token-1\x01\x01',
    );
  });

  it('reuses the token while it lasts', async () => {
    await sendEmail(microsoftConfig('client-cache', smtpServer.port), message);
    await sendEmail(microsoftConfig('client-cache', smtpServer.port), message);

    expect(tokenRequests).toHaveLength(1);
    expect(authLines).toHaveLength(2);
  });

  it('gives up without retrying when Microsoft refuses the credentials', async () => {
    tokenResponse = () =>
      Response.json(
        { error: 'invalid_client', error_description: 'Invalid client secret' },
        { status: 401 },
      );

    const result = await sendEmail(microsoftConfig('client-refused', smtpServer.port), message);

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('refused the credentials');
    expect(result.error).toContain('Invalid client secret');
    expect(authLines).toHaveLength(0);
  });

  it('retries later when Microsoft cannot answer', async () => {
    tokenResponse = () => Response.json({ error: 'temporarily_unavailable' }, { status: 503 });

    const result = await sendEmail(microsoftConfig('client-unavailable', smtpServer.port), message);

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.error).toContain('microsoft token request failed (503)');
    expect(tokenRequests).toHaveLength(1);
  });

  it('asks for a new token once the last one is about to expire', async () => {
    // 30 s is inside the minute of margin, so the token is never reused.
    tokenResponse = () => Response.json({ access_token: 'token-short', expires_in: 30 });

    await sendEmail(microsoftConfig('client-expiring', smtpServer.port), message);
    await sendEmail(microsoftConfig('client-expiring', smtpServer.port), message);

    expect(tokenRequests).toHaveLength(2);
  });

  it('refuses to send without the app credentials', async () => {
    const config = microsoftConfig('client-none', smtpServer.port);
    delete config.smtp.oauth;

    const result = await sendEmail(config, message);

    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(result.error).toContain('app credentials are missing');
    expect(authLines).toHaveLength(0);
  });
});

describe('god email settings with Microsoft 365', () => {
  beforeEach(resetDb);

  function draft(clientId: string, overrides: { auth?: string; tenantId?: string } = {}) {
    return {
      smtp: {
        enabled: true,
        host: '127.0.0.1',
        port: smtpServer.port,
        encryption: 'none' as const,
        username: 'mailer@example.com',
        timeout: 5,
        auth: (overrides.auth ?? 'microsoft365') as 'microsoft365',
        oauth: {
          tenantId: overrides.tenantId ?? 'tenant-1',
          clientId,
          clientSecret: 'app-secret',
        },
      },
      resend: { enabled: false },
      from: 'mailer@example.com',
    };
  }

  it('sends the test email through Microsoft 365', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-settings'].test.post(draft('client-test'));

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ recipient: 'root@example.com' });
    expect(tokenRequests).toHaveLength(1);
    expect(authLines[0]).toStartWith('AUTH XOAUTH2 ');
  });

  it('says the credentials were refused when Microsoft refuses the app', async () => {
    const { god } = await setup();
    tokenResponse = () =>
      Response.json(
        { error: 'invalid_client', error_description: 'Invalid client secret' },
        { status: 401 },
      );

    const res = await god.api.god['email-settings'].test.post(draft('client-refused-test'));

    expect(res.status).toBe(502);
    expect(res.error!.value).toMatchObject({
      error: 'The email provider rejected the credentials',
    });
    expect(tokenRequests).toHaveLength(1);
    expect(authLines).toHaveLength(0);
  });

  it('refuses an unknown authentication mode', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-settings'].put(draft('client-1', { auth: 'kerberos' }));

    expect(res.status).toBe(400);
  });

  it('takes a tenant id of up to 128 characters', async () => {
    const { god } = await setup();

    const atLimit = await god.api.god['email-settings'].put(
      draft('client-1', { tenantId: 'a'.repeat(128) }),
    );
    const over = await god.api.god['email-settings'].put(
      draft('client-1', { tenantId: 'a'.repeat(129) }),
    );

    expect(atLimit.status).toBe(200);
    expect(over.status).toBe(400);
  });

  it('stores the app credentials, never returns the secret, and keeps it on a later save', async () => {
    const { god } = await setup();
    const smtp = {
      enabled: true,
      host: 'smtp.office365.com',
      port: 587,
      encryption: 'tls' as const,
      username: 'mailer@example.com',
      timeout: 15,
      auth: 'microsoft365' as const,
    };

    const saved = await god.api.god['email-settings'].put({
      smtp: {
        ...smtp,
        oauth: { tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 'app-secret' },
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.data!.smtp).toMatchObject({
      auth: 'microsoft365',
      oauth: { tenantId: 'tenant-1', clientId: 'client-1', hasClientSecret: true },
    });
    expect(JSON.stringify(saved.data)).not.toContain('app-secret');

    await god.api.god['email-settings'].put({
      smtp: { ...smtp, oauth: { tenantId: 'tenant-1', clientId: 'client-1' } },
    });

    const stored = await resolveEmailConfig();
    expect(stored.smtp.oauth).toEqual({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      clientSecret: 'app-secret',
    });
  });

  it('keeps the mode on a save that leaves it out', async () => {
    const { god } = await setup();
    await god.api.god['email-settings'].put(draft('client-1'));
    const { auth: _auth, ...smtpWithoutMode } = draft('client-1').smtp;

    await god.api.god['email-settings'].put({ smtp: smtpWithoutMode });

    const res = await god.api.god['email-settings'].get();
    expect(res.data!.smtp.auth).toBe('microsoft365');
  });
});
