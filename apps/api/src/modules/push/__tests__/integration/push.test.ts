import { afterEach, beforeEach, describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, pushSubscription } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A browser's push subscription is stored for the session user only, with the VAPID
// public key it was made with. The worker later POSTs to its endpoint, so only an https
// endpoint on a public address is taken. Push is on while the three WEB_PUSH_* variables
// are set.

const ENV = ['WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'WEB_PUSH_SUBJECT'];
const PUBLIC_KEY =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(new Uint8Array(bytes)).toString('base64url');

// What PushSubscription.toJSON() gives for a new browser subscription.
async function browserSubscription(endpoint = `https://example.com/push/${randomUUID()}`) {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  return {
    endpoint,
    keys: {
      p256dh: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
      auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

async function member() {
  const u = await signUpTestUser();
  return { ...u, api: authedApi(u.cookie) };
}

let saved: (string | undefined)[];

beforeEach(async () => {
  saved = ENV.map((name) => process.env[name]);
  await resetDb();
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = PUBLIC_KEY;
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
  process.env.WEB_PUSH_SUBJECT = 'mailto:ops@example.com';
});

afterEach(() => {
  ENV.forEach((name, i) => {
    if (saved[i] === undefined) delete process.env[name];
    else process.env[name] = saved[i];
  });
});

describe('push config', () => {
  it('hands out the public key while the keys are set', async () => {
    const { api } = await member();

    const res = await api.push.config.get();

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ enabled: true, publicKey: PUBLIC_KEY });
  });

  it('reports push off when any of the three variables is unset', async () => {
    const { api } = await member();
    delete process.env.WEB_PUSH_SUBJECT;

    const res = await api.push.config.get();

    expect(res.data).toEqual({ enabled: false, publicKey: null });
  });
});

describe('push subscriptions', () => {
  it('stores a subscription with the key it was made with, and lists it', async () => {
    const { api } = await member();
    const subscription = await browserSubscription();

    const res = await api.push.subscriptions.post(subscription);

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ endpoint: subscription.endpoint });
    const list = await api.push.subscriptions.get();
    expect(list.data).toEqual([res.data!]);
    // No route returns the key, and the worker compares it with the instance's.
    const [row] = await db
      .select({ vapidPublicKey: pushSubscription.vapidPublicKey })
      .from(pushSubscription);
    expect(row).toEqual({ vapidPublicKey: PUBLIC_KEY });
  });

  it('updates the keys of an endpoint it already holds instead of adding a row', async () => {
    const { api } = await member();
    const first = await browserSubscription();
    const created = (await api.push.subscriptions.post(first)).data!;
    const renewed = await browserSubscription(first.endpoint);

    const res = await api.push.subscriptions.post(renewed);

    expect(res.status).toBe(201);
    expect(res.data!.id).toBe(created.id);
    // The keys are never returned.
    const rows = await db
      .select({ p256dh: pushSubscription.p256dh, auth: pushSubscription.auth })
      .from(pushSubscription);
    expect(rows).toEqual([renewed.keys]);
  });

  it('keeps the newest 10 subscriptions of a user', async () => {
    const { api } = await member();
    const endpoints: string[] = [];
    for (let i = 0; i < 11; i++) {
      const subscription = await browserSubscription();
      endpoints.push(subscription.endpoint);
      expect((await api.push.subscriptions.post(subscription)).status).toBe(201);
    }

    const list = (await api.push.subscriptions.get()).data!;

    expect(list).toHaveLength(10);
    expect(list.map((s) => s.endpoint).sort()).toEqual(endpoints.slice(1).sort());
  });

  it('removes a subscription by its endpoint', async () => {
    const { api } = await member();
    const subscription = await browserSubscription();
    await api.push.subscriptions.post(subscription);

    const res = await api.push.subscriptions.delete({ endpoint: subscription.endpoint });

    expect(res.status).toBe(204);
    expect((await api.push.subscriptions.get()).data).toEqual([]);
    const again = await api.push.subscriptions.delete({ endpoint: subscription.endpoint });
    expect(again.status).toBe(204);
  });

  it("never lists, removes or takes over another user's subscription", async () => {
    await signUpTestUser();
    const owner = await member();
    const other = await member();
    const subscription = await browserSubscription();
    const stored = (await owner.api.push.subscriptions.post(subscription)).data!;

    expect((await other.api.push.subscriptions.get()).data).toEqual([]);
    expect(
      (await other.api.push.subscriptions.delete({ endpoint: subscription.endpoint })).status,
    ).toBe(204);
    const takeover = await other.api.push.subscriptions.post(
      await browserSubscription(subscription.endpoint),
    );
    expect(takeover.status).toBe(409);

    const [row] = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.endpoint, subscription.endpoint));
    expect(row).toMatchObject({ id: stored.id, userId: owner.userId, ...subscription.keys });
  });

  it.each([
    ['an http endpoint', 'http://example.com/push/1'],
    ['a private address', 'https://10.0.0.7/push/1'],
    ['a local host', 'https://localhost/push/1'],
    ['a value that is not a URL', 'not a url'],
  ])('refuses %s', async (_case, endpoint) => {
    const { api } = await member();

    const res = await api.push.subscriptions.post(await browserSubscription(endpoint));

    expect(res.status).toBe(400);
    expect((await api.push.subscriptions.get()).data).toEqual([]);
  });

  it('refuses a host SSRF_ALLOWED_HOSTS trusts, which any member could otherwise name', async () => {
    const { api } = await member();
    const allowed = process.env.SSRF_ALLOWED_HOSTS;
    process.env.SSRF_ALLOWED_HOSTS = 'localhost';
    try {
      const res = await api.push.subscriptions.post(
        await browserSubscription('https://localhost/push/1'),
      );
      expect(res.status).toBe(400);
    } finally {
      if (allowed === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
      else process.env.SSRF_ALLOWED_HOSTS = allowed;
    }
  });

  it('refuses keys the payload cannot be encrypted to', async () => {
    const { api } = await member();
    const subscription = await browserSubscription();

    const shortAuth = await api.push.subscriptions.post({
      ...subscription,
      keys: { ...subscription.keys, auth: b64url(new Uint8Array(8)) },
    });
    const offCurve = await api.push.subscriptions.post({
      ...subscription,
      keys: { ...subscription.keys, p256dh: b64url(Uint8Array.of(4, ...new Uint8Array(64))) },
    });

    expect(shortAuth.status).toBe(400);
    expect(offCurve.status).toBe(400);
    expect((await api.push.subscriptions.get()).data).toEqual([]);
  });

  it('refuses a subscription while push is off', async () => {
    const { api } = await member();
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

    const res = await api.push.subscriptions.post(await browserSubscription());

    expect(res.status).toBe(400);
  });
});
