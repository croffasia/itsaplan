import { afterEach, beforeEach, describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, pushSubscription, user } from '@repo/db';
import type { PinnedRequestInit } from '@repo/net';
import { eq } from 'drizzle-orm';
import { sendPush, type PushFetch } from '../../notification-send';

// A push goes to the browser of a subscription row the api stored, and the push
// service's answer decides what happens to the row and the delivery. A fake fetch
// stands in for the push service; the rows are inserted directly, as the api writes
// them.

const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const;
const ENV = ['WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'WEB_PUSH_SUBJECT'];
const PAYLOAD = {
  title: 'MKT-7 Fix login',
  text: 'Mentioned by Ada',
  url: 'https://plan.test/acme/issue/MKT-7#comment-5',
  tag: 'inbox-12',
};

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(new Uint8Array(bytes)).toString('base64url');

let saved: (string | undefined)[];

beforeEach(async () => {
  saved = ENV.map((name) => process.env[name]);
  const vapid = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
  ])) as CryptoKeyPair;
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = b64url(
    await crypto.subtle.exportKey('raw', vapid.publicKey),
  );
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = (
    await crypto.subtle.exportKey('jwk', vapid.privateKey)
  ).d;
  process.env.WEB_PUSH_SUBJECT = 'mailto:ops@example.test';
});

afterEach(() => {
  ENV.forEach((name, i) => {
    if (saved[i] === undefined) delete process.env[name];
    else process.env[name] = saved[i];
  });
});

interface Browser {
  id: number;
  keys: CryptoKeyPair;
  auth: Uint8Array<ArrayBuffer>;
}

// Made with the instance's current VAPID public key unless another is given.
async function subscribedBrowser(vapidPublicKey?: string): Promise<Browser> {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: 'Member', email: `${userId}@example.test` });
  const keys = (await crypto.subtle.generateKey(P256, true, ['deriveBits'])) as CryptoKeyPair;
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const [row] = await db
    .insert(pushSubscription)
    .values({
      userId,
      endpoint: `https://push.example.test/send/${randomUUID()}`,
      p256dh: b64url(await crypto.subtle.exportKey('raw', keys.publicKey)),
      auth: b64url(auth),
      vapidPublicKey: vapidPublicKey ?? process.env.WEB_PUSH_VAPID_PUBLIC_KEY!,
    })
    .returning({ id: pushSubscription.id });
  return { id: row!.id, keys, auth };
}

function pushService(status: number) {
  const calls: { url: string; init: PinnedRequestInit }[] = [];
  const fetch: PushFetch = async (url, init) => {
    calls.push({ url, init: init! });
    return new Response(status === 201 ? null : 'push service says no', { status });
  };
  return { fetch, calls };
}

async function storedRow(id: number) {
  const [row] = await db.select().from(pushSubscription).where(eq(pushSubscription.id, id));
  return row;
}

// What the browser's service worker would read: the single record decrypted with the
// browser's own keys (RFC 8291), less its 0x02 delimiter.
async function decrypt(sent: Buffer, browser: Browser): Promise<unknown> {
  const body = new Uint8Array(sent);
  const idlen = body[20]!;
  const salt = body.subarray(0, 16);
  const senderPublic = body.subarray(21, 21 + idlen);
  const browserPublic = new Uint8Array(
    await crypto.subtle.exportKey('raw', browser.keys.publicKey),
  );
  const sender = await crypto.subtle.importKey('raw', senderPublic, P256, false, []);
  const secret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: sender },
    browser.keys.privateKey,
    256,
  );
  type Bytes = Uint8Array<ArrayBuffer>;
  const hkdf = async (salt: Bytes, ikm: ArrayBuffer, info: Bytes, bits: number) =>
    crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
      bits,
    );
  const text = (value: string) => new TextEncoder().encode(value);
  const info = new Uint8Array(
    Buffer.concat([text('WebPush: info\0'), browserPublic, senderPublic]),
  );
  const ikm = await hkdf(browser.auth, secret, info, 256);
  const cek = await hkdf(salt, ikm, text('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, text('Content-Encoding: nonce\0'), 96);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const record = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, body.subarray(21 + idlen)),
  );
  expect(record.at(-1)).toBe(0x02);
  return JSON.parse(new TextDecoder().decode(record.subarray(0, -1)));
}

describe('sendPush', () => {
  it('posts the encrypted message with a VAPID token', async () => {
    const browser = await subscribedBrowser();
    const service = pushService(201);

    const result = await sendPush(String(browser.id), PAYLOAD, service.fetch);

    expect(result).toEqual({ ok: true });
    const [call] = service.calls;
    expect(call!.url).toStartWith('https://push.example.test/send/');
    expect(call!.init).toMatchObject({
      method: 'POST',
      publicOnly: true,
      headers: {
        'content-encoding': 'aes128gcm',
        ttl: '86400',
        urgency: 'normal',
      },
    });
    const headers = call!.init.headers as Record<string, string>;
    expect(headers.authorization).toStartWith('vapid t=');
    expect(headers.authorization).toEndWith(`, k=${process.env.WEB_PUSH_VAPID_PUBLIC_KEY}`);
    expect(await decrypt(call!.init.body as Buffer, browser)).toEqual({
      title: PAYLOAD.title,
      body: PAYLOAD.text,
      url: PAYLOAD.url,
      tag: PAYLOAD.tag,
    });
    expect(await storedRow(browser.id)).toBeDefined();
  });

  it.each([404, 410])('deletes a subscription the push service answers %d for', async (status) => {
    const browser = await subscribedBrowser();

    const result = await sendPush(String(browser.id), PAYLOAD, pushService(status).fetch);

    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(result.error).toContain(`HTTP ${status}`);
    expect(await storedRow(browser.id)).toBeUndefined();
  });

  it.each([429, 500, 503])('retries an HTTP %d and keeps the subscription', async (status) => {
    const browser = await subscribedBrowser();

    const result = await sendPush(String(browser.id), PAYLOAD, pushService(status).fetch);

    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(await storedRow(browser.id)).toBeDefined();
  });

  it.each([400, 401, 403, 413])(
    'fails an HTTP %d for good and keeps the subscription',
    async (status) => {
      const browser = await subscribedBrowser();

      const result = await sendPush(String(browser.id), PAYLOAD, pushService(status).fetch);

      expect(result).toMatchObject({ ok: false, retryable: false });
      expect(await storedRow(browser.id)).toBeDefined();
    },
  );

  it('retries a request that did not reach the push service', async () => {
    const browser = await subscribedBrowser();
    const fetch: PushFetch = async () => {
      throw new Error('request timed out');
    };

    const result = await sendPush(String(browser.id), PAYLOAD, fetch);

    expect(result).toEqual({ ok: false, retryable: true, error: 'request timed out' });
  });

  it('cuts off an endpoint that never finishes its answer at the deadline, and retries', async () => {
    const browser = await subscribedBrowser();
    // The deadline is 10 seconds; the test makes the signal it gets fire at once.
    const timeout = AbortSignal.timeout;
    const asked: number[] = [];
    AbortSignal.timeout = (ms: number) => (asked.push(ms), timeout.call(AbortSignal, 10));
    // As pinnedFetch does: the request is destroyed when its signal fires.
    const fetch: PushFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new Error('request aborted')));
      });

    const result = await sendPush(String(browser.id), PAYLOAD, fetch).finally(() => {
      AbortSignal.timeout = timeout;
    });

    expect(asked).toEqual([10_000]);
    expect(result).toEqual({ ok: false, retryable: true, error: 'request aborted' });
    expect(await storedRow(browser.id)).toBeDefined();
  });

  it('fails a delivery to a subscription made with other VAPID keys, without a request or deleting it', async () => {
    const browser = await subscribedBrowser(
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    );
    const service = pushService(201);

    const result = await sendPush(String(browser.id), PAYLOAD, service.fetch);

    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(service.calls).toHaveLength(0);
    expect(await storedRow(browser.id)).toBeDefined();
  });

  it('drops a delivery whose subscription is gone, without a request', async () => {
    const browser = await subscribedBrowser();
    await db.delete(pushSubscription).where(eq(pushSubscription.id, browser.id));
    const service = pushService(201);

    expect(await sendPush(String(browser.id), PAYLOAD, service.fetch)).toEqual({ ok: true });
    expect(service.calls).toHaveLength(0);
  });

  it('fails for good while the VAPID keys are unset', async () => {
    const browser = await subscribedBrowser();
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const service = pushService(201);

    const result = await sendPush(String(browser.id), PAYLOAD, service.fetch);

    expect(result).toEqual({ ok: false, retryable: false, error: 'push not configured' });
    expect(service.calls).toHaveLength(0);
  });
});
