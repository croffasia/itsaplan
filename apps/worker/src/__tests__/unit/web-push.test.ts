import { describe, it, expect } from 'bun:test';
import { MAX_PLAINTEXT_BYTES, encryptPushPayload, vapidAuthorization } from '../../web-push';

const b64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));
const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(new Uint8Array(bytes)).toString('base64url');

// RFC 8291 §5 and Appendix A: the example message, its keys, salt and result.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPublic:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPublic:
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  message:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function rfcSenderKeys(): Promise<CryptoKeyPair> {
  const point = b64(RFC.asPublic);
  const curve = { name: 'ECDH', namedCurve: 'P-256' };
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(point.subarray(1, 33)),
    y: b64url(point.subarray(33, 65)),
    d: RFC.asPrivate,
  };
  return {
    publicKey: await crypto.subtle.importKey('raw', point, curve, true, []),
    privateKey: await crypto.subtle.importKey('jwk', jwk, curve, false, ['deriveBits']),
  };
}

describe('encryptPushPayload', () => {
  it('produces the message of the RFC 8291 example', async () => {
    const body = await encryptPushPayload(
      new TextEncoder().encode(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.authSecret },
      { salt: b64(RFC.salt), senderKeys: await rfcSenderKeys() },
    );

    expect(b64url(body)).toBe(RFC.message);
  });

  it('uses a new salt and sender key for every message', async () => {
    const keys = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    const plaintext = new TextEncoder().encode(RFC.plaintext);
    const [a, b] = await Promise.all([
      encryptPushPayload(plaintext, keys),
      encryptPushPayload(plaintext, keys),
    ]);

    expect(a.length).toBe(b64(RFC.message).length);
    // salt (16) | rs (4) | idlen (1) | keyid (65)
    expect(a.subarray(0, 16)).not.toEqual(b.subarray(0, 16));
    expect(a.subarray(21, 86)).not.toEqual(b.subarray(21, 86));
  });

  it('refuses a plaintext that does not fit in one 4096-byte message', async () => {
    const keys = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    const largest = await encryptPushPayload(new Uint8Array(MAX_PLAINTEXT_BYTES), keys);
    expect(largest.length).toBe(4096);
    await expect(encryptPushPayload(new Uint8Array(MAX_PLAINTEXT_BYTES + 1), keys)).rejects.toThrow(
      'push payload is over',
    );
  });
});

describe('vapidAuthorization', () => {
  it('signs a token for the push service origin that verifies with the public key', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
    const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const before = Math.floor(Date.now() / 1000);

    const header = await vapidAuthorization('https://push.example.net/p/JzLQ3raZJfFBR0aq', {
      publicKey,
      privateKey: d!,
      subject: 'mailto:push@example.com',
    });

    const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match!;
    expect(k).toBe(publicKey);
    expect(JSON.parse(Buffer.from(head!, 'base64url').toString())).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });
    const body = JSON.parse(Buffer.from(claims!, 'base64url').toString());
    expect(body).toMatchObject({ aud: 'https://push.example.net', sub: 'mailto:push@example.com' });
    expect(body.exp).toBeGreaterThanOrEqual(before + 12 * 60 * 60);
    expect(body.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 12 * 60 * 60);

    const verifier = await crypto.subtle.importKey(
      'raw',
      b64(k!),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifier,
      b64(signature!),
      new TextEncoder().encode(`${head}.${claims}`),
    );
    expect(verified).toBe(true);
  });
});
