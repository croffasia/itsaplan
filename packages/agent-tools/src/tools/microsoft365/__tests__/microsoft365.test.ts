import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearTokenCache, drivePath, explainGraphError, htmlToText, msUser } from '../client';
import { isoDateTime } from '../calendar';
import { microsoft365FileRead, microsoft365FilesSearch, microsoft365FileWrite } from '../files';
import { microsoft365MailSend } from '../mail';
import { microsoft365 } from '..';

const CRED = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  clientSecret: 's3cret',
  defaultUser: 'agent@acme.com',
};

type Call = { url: string; init: RequestInit };
let calls: Call[];
let answers: ((url: string) => Response | undefined)[];
const realFetch = globalThis.fetch;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  clearTokenCache();
  calls = [];
  answers = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://login.microsoftonline.com/')) {
      return json({ access_token: 'tok', expires_in: 3600 });
    }
    for (const answer of answers) {
      const res = answer(url);
      if (res) return res;
    }
    return json({ value: [] });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('microsoft365 helpers', () => {
  it('encodes each path segment and drops dot segments', () => {
    expect(drivePath('/Reports/../Q3 plan.md')).toBe('Reports/Q3%20plan.md');
    expect(() => drivePath(' / ')).toThrow();
  });

  it('falls back to the default user and refuses when there is none', () => {
    expect(msUser(CRED, '')).toBe('agent%40acme.com');
    expect(msUser(CRED, 'ann@acme.com')).toBe('ann%40acme.com');
    expect(() => msUser({ ...CRED, defaultUser: '' }, undefined)).toThrow(/default user/);
  });

  it('names the missing permission on a 403', () => {
    expect(explainGraphError(403, {}, 'Mail.Send')).toContain('"Mail.Send" application permission');
  });

  it('reads HTML mail as text', () => {
    expect(htmlToText('<p>Hi&nbsp;Ann</p><style>p{}</style><br>Bye &amp; thanks')).toBe(
      'Hi Ann\n\nBye & thanks',
    );
  });

  it('accepts a plain date for a calendar range', () => {
    expect(isoDateTime('2026-10-20')).toBe('2026-10-20T00:00:00');
    expect(isoDateTime('2026-10-20', true)).toBe('2026-10-20T23:59:59');
    expect(() => isoDateTime('soon')).toThrow();
  });

  it('marks only the tools that change something as writes', () => {
    const writes = microsoft365.tools.filter((t) => t.writes).map((t) => t.key);
    expect(writes.sort()).toEqual([
      'microsoft365_calendar_create',
      'microsoft365_file_write',
      'microsoft365_mail_send',
    ]);
  });
});

describe('microsoft365 tools', () => {
  it('gets an app token once and searches the default user OneDrive', async () => {
    answers.push((url) =>
      url.includes('/search(')
        ? json({
            value: [
              {
                id: 'f1',
                name: 'plan.md',
                size: 3,
                parentReference: { path: '/drive/root:/Docs' },
              },
            ],
          })
        : undefined,
    );
    const out = (await microsoft365FilesSearch.execute(CRED, { query: "Bob's plan" })) as {
      results: { id: string; path: string }[];
    };
    await microsoft365FilesSearch.execute(CRED, { query: 'again' });
    expect(calls.filter((c) => c.url.includes('login.microsoftonline.com'))).toHaveLength(1);
    const search = calls.find((c) => c.url.includes('/search('))!;
    expect(search.url).toContain('users/agent%40acme.com/drive/root/search');
    expect(search.url).toContain("Bob''s");
    expect((search.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(out.results[0]).toMatchObject({ id: 'f1', path: '/Docs/plan.md' });
  });

  it('uses a SharePoint site library when a site id is given', async () => {
    await microsoft365FileWrite.execute(CRED, { path: 'a/b.md', content: 'hi', siteId: 'site,1' });
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toBe(
      'https://graph.microsoft.com/v1.0/sites/site%2C1/drive/root:/a/b.md:/content',
    );
    expect(put.init.body).toBe('hi');
  });

  it('returns text content and flags a binary file', async () => {
    answers.push((url) =>
      url.endsWith('/content')
        ? new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })
        : url.includes('/items/')
          ? json({ id: 'x', name: 'deck.pdf', webUrl: 'https://acme.sharepoint.com/deck' })
          : undefined,
    );
    const out = (await microsoft365FileRead.execute(CRED, { fileId: 'x' })) as Record<
      string,
      unknown
    >;
    expect(out.text).toBe('');
    expect(out.note).toContain('webUrl');
  });

  it('sends mail from the named mailbox', async () => {
    answers.push((url) =>
      url.endsWith('/sendMail') ? new Response(null, { status: 202 }) : undefined,
    );
    await microsoft365MailSend.execute(CRED, {
      to: ['ann@acme.com'],
      subject: 'Hi',
      body: 'Hello',
      user: 'ops@acme.com',
    });
    const send = calls.find((c) => c.url.endsWith('/sendMail'))!;
    expect(send.url).toContain('users/ops%40acme.com/sendMail');
    expect(JSON.parse(String(send.init.body)).message.toRecipients).toEqual([
      { emailAddress: { address: 'ann@acme.com' } },
    ]);
  });

  it('retries a throttled call after Retry-After', async () => {
    let throttled = false;
    answers.push((url) => {
      if (!url.includes('/search(') || throttled) return undefined;
      throttled = true;
      return json({ error: { code: 'TooManyRequests' } }, 429, { 'retry-after': '0.01' });
    });
    await microsoft365FilesSearch.execute(CRED, { query: 'x' });
    expect(calls.filter((c) => c.url.includes('/search('))).toHaveLength(2);
  });

  it('reports refused app credentials', async () => {
    globalThis.fetch = (async () =>
      json(
        { error_description: 'AADSTS7000215: Invalid client secret.\r\nTrace' },
        401,
      )) as unknown as typeof fetch;
    await expect(microsoft365FilesSearch.execute(CRED, { query: 'x' })).rejects.toThrow(
      'Microsoft refused the app credentials: AADSTS7000215: Invalid client secret.',
    );
  });
});
