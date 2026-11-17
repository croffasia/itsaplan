import { describe, it, expect, beforeEach } from 'bun:test';
import { auth } from '@repo/auth';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { setup } from '../helpers';

// The limits per client address on sign-in and on the endpoints that send mail. better-auth
// applies them only in production, so the test turns its limiter on for the requests it sends.

const origin = (process.env.APP_URL ?? '').split(',')[0].trim();

// The statuses of `count` requests to one auth path from one address. A new address per call
// keeps the in-memory counts of other tests out.
let address = 0;
async function statuses(path: string, count: number): Promise<number[]> {
  address += 1;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await app.handle(
      new Request(`http://localhost/api/auth${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin,
          'x-forwarded-for': `203.0.113.${address}`,
        },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password-123' }),
      }),
    );
    result.push(res.status);
  }
  return result;
}

// Only the last of the requests is refused.
const refusedLast = (list: number[]) =>
  list.slice(0, -1).every((status) => status !== 429) && list.at(-1) === 429;

describe('god sign-in rate limits', () => {
  beforeEach(resetDb);

  it("starts at better-auth's limits", async () => {
    const { god } = await setup();

    expect((await god.api.god['auth-settings'].get()).data).toMatchObject({
      signInRateLimit: 3,
      emailRateLimit: 3,
      magicLinkRateLimit: 5,
    });
  });

  it('applies each stored limit to the paths it names', async () => {
    const { god } = await setup();
    await god.api.god['auth-settings'].put({
      signInRateLimit: 5,
      emailRateLimit: 4,
      magicLinkRateLimit: 2,
    });
    const context = await auth.$context;
    context.rateLimit.enabled = true;
    try {
      expect(refusedLast(await statuses('/sign-in/email', 6))).toBe(true);
      expect(refusedLast(await statuses('/sign-up/email', 6))).toBe(true);
      expect(refusedLast(await statuses('/request-password-reset', 5))).toBe(true);
      expect(refusedLast(await statuses('/sign-in/magic-link', 3))).toBe(true);
    } finally {
      context.rateLimit.enabled = false;
    }
  });

  it('takes each limit from 1 to 1000 and refuses anything else', async () => {
    const { god } = await setup();
    const fields = ['signInRateLimit', 'emailRateLimit', 'magicLinkRateLimit'] as const;

    for (const field of fields) {
      for (const value of [1, 1000]) {
        expect((await god.api.god['auth-settings'].put({ [field]: value })).status).toBe(200);
      }
      for (const value of [0, 1001, 2.5]) {
        expect((await god.api.god['auth-settings'].put({ [field]: value })).status).toBe(400);
      }
    }
  });
});
