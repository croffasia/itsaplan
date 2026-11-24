import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { auth, setAuthSettings, setEmailSettings } from '@repo/auth';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const realFetch = globalThis.fetch;
let subjects: string[] = [];

function post(path: string, body: unknown, language?: string) {
  return auth.handler(
    new Request(`${new URL(process.env.API_URL!).origin}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(language ? { 'accept-language': language } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function nextSubject(): Promise<string> {
  for (let i = 0; i < 50 && subjects.length === 0; i++) await Bun.sleep(20);
  return subjects.shift()!;
}

describe('the language of an authentication email', () => {
  beforeEach(async () => {
    await resetDb();
    subjects = [];
    await setEmailSettings({
      resend: { enabled: true, apiKey: 're_test' },
      from: 'noreply@example.test',
    });
    await setAuthSettings({ magicLink: true });
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).startsWith('https://api.resend.com/')) return realFetch(input, init);
      subjects.push(JSON.parse(String(init?.body)).subject);
      return Response.json({ id: 'sent' });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('is the one the account saved, whatever the browser asks for', async () => {
    const user = await signUpTestUser({ email: 'saved@example.test' });
    await authedApi(user.cookie).account.preferences.patch({ locale: 'uk' });
    subjects = [];

    await post('/request-password-reset', { email: user.email, redirectTo: '/reset' }, 'fr');

    expect(await nextSubject()).toBe('Скидання пароля');
  });

  it('is the one of the browser for an address with no saved language', async () => {
    await post('/sign-in/magic-link', { email: 'new@example.test' }, 'ru-RU,en;q=0.5');

    expect(await nextSubject()).toBe('Ссылка для входа');
  });

  it('is English with neither', async () => {
    await post('/sign-in/magic-link', { email: 'new@example.test' });

    expect(await nextSubject()).toBe('Your sign-in link');
  });
});
