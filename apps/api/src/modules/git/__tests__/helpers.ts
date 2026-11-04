import { createVerify, generateKeyPairSync } from 'node:crypto';

export function appKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }) as string,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
  };
}

export function isValidAppJwt(
  authorization: string | null,
  appId: string,
  publicKey: string,
): boolean {
  const [head, payload, signature] = authorization?.replace(/^Bearer /, '').split('.') ?? [];
  if (!head || !payload || !signature) return false;
  const signed = createVerify('RSA-SHA256')
    .update(`${head}.${payload}`)
    .verify(publicKey, Buffer.from(signature, 'base64url'));
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    iss?: string;
    exp?: number;
  };
  return signed && claims.iss === appId && (claims.exp ?? 0) > Date.now() / 1000;
}
