// Web Push on WebCrypto: the aes128gcm encryption of a message to one browser (RFC 8291)
// and the VAPID token that names this instance to the push service (RFC 8292). Nothing
// here reads the database or the network.

type Bytes = Uint8Array<ArrayBuffer>;

const text = new TextEncoder();

// One record carries the whole message, and the header announces this record size.
const RECORD_SIZE = 4096;

// A push service need not accept a body over 4096 bytes. The 86-byte header, the
// 16-byte tag and the delimiter octet leave this much for the plaintext (RFC 8291 §4).
export const MAX_PLAINTEXT_BYTES = 3993;

// RFC 8292 §2 allows up to 24 hours. Half of that leaves room for a clock here that runs
// ahead of the push service's. Each send signs a new token.
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const;

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64url(value: string): Bytes {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// HKDF-SHA-256: extract with the salt, then expand with the info to `bytes` bytes.
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const params = { name: 'HKDF', hash: 'SHA-256', salt, info };
  return new Uint8Array(await crypto.subtle.deriveBits(params, key, bytes * 8));
}

// The browser's keys from its PushSubscription, base64url.
export interface PushKeys {
  p256dh: string;
  auth: string;
}

// Random for every message unless given: the RFC 8291 example fixes both.
export interface EncryptOptions {
  salt?: Bytes;
  senderKeys?: CryptoKeyPair;
}

// The body of one push message: the aes128gcm header, then the single encrypted record.
export async function encryptPushPayload(
  plaintext: Uint8Array,
  keys: PushKeys,
  options: EncryptOptions = {},
): Promise<Bytes> {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) {
    throw new Error(`push payload is over ${MAX_PLAINTEXT_BYTES} bytes`);
  }
  const uaPublic = fromBase64url(keys.p256dh);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const sender =
    options.senderKeys ??
    ((await crypto.subtle.generateKey(P256, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey));
  const receiver = await crypto.subtle.importKey('raw', uaPublic, P256, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: receiver }, sender.privateKey, 256),
  );

  const keyInfo = concat(text.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(fromBase64url(keys.auth), ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, text.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, text.encode('Content-Encoding: nonce\0'), 12);

  // The 0x02 delimiter marks the last record. No padding follows it.
  const record = concat(plaintext, Uint8Array.of(0x02));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record);

  // salt (16) | rs (uint32) | idlen (1) | keyid: the sender's public key.
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, new Uint8Array(ciphertext));
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// The Authorization header of a push to `endpoint`: an ES256 JWT for the push service's
// origin, and the public key that verifies it.
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys): Promise<string> {
  const point = fromBase64url(vapid.publicKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64url(point.subarray(1, 33)),
      y: base64url(point.subarray(33, 65)),
      d: base64url(fromBase64url(vapid.privateKey)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const encode = (value: object) => base64url(text.encode(JSON.stringify(value)));
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
    sub: vapid.subject,
  })}`;
  // WebCrypto signs ECDSA as r || s, the form a JWS carries.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    text.encode(unsigned),
  );
  return `vapid t=${unsigned}.${base64url(new Uint8Array(signature))}, k=${base64url(point)}`;
}
