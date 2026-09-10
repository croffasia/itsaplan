import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Symmetric encryption for secrets stored at rest (provider API keys). AES-256-GCM
// with a per-value random IV; the auth tag is kept alongside so decryption is
// authenticated. The 32-byte key is derived from APP_ENCRYPTION_KEY with SHA-256,
// so the env value can be any sufficiently random secret (e.g. a Coolify-generated
// password) rather than a strict base64-of-32-bytes value. A missing key is a clear
// startup-time error rather than a silent weak default. Changing the value makes
// existing stored credentials undecryptable.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length.

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('APP_ENCRYPTION_KEY is not set: generate one with `openssl rand -base64 32`.');
  }
  cachedKey = createHash('sha256').update(raw, 'utf8').digest();
  return cachedKey;
}

export interface EncryptedSecret {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

// Encrypts a UTF-8 plaintext into base64 ciphertext + iv + auth tag.
export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

// Decrypts a value produced by encryptSecret. Throws if the key is wrong or the
// data was tampered with (GCM auth failure).
export function decryptSecret(enc: EncryptedSecret): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
