import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { githubAppJwt } from '../../github-app';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string;
const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const NOW_SECONDS = 1_700_000_000;

function decode(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function verifies(jwt: string): boolean {
  const [header, payload, signature] = jwt.split('.');
  return createVerify('RSA-SHA256')
    .update(`${header}.${payload}`)
    .verify(publicKey, Buffer.from(signature!, 'base64url'));
}

describe('githubAppJwt', () => {
  beforeEach(() => setSystemTime(new Date(NOW_SECONDS * 1000)));
  afterEach(() => setSystemTime());

  it.each([
    ['PKCS#1', pkcs1],
    ['PKCS#8', pkcs8],
  ])('signs a JWT that the public key verifies from a %s key', (_name, pem) => {
    expect(verifies(githubAppJwt('12345', pem))).toBe(true);
  });

  it('sets the header, issuer and a ten minute window starting a minute ago', () => {
    const [header, payload] = githubAppJwt('Iv1.abc', pkcs1).split('.');
    expect(decode(header!)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(payload!)).toEqual({
      iat: NOW_SECONDS - 60,
      exp: NOW_SECONDS + 540,
      iss: 'Iv1.abc',
    });
  });

  it.each([
    ['garbage', 'not a key'],
    [
      'an EC key',
      generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      }) as string,
    ],
  ])('rejects %s with a 400', (_name, pem) => {
    expect(() => githubAppJwt('1', pem)).toThrow(
      expect.objectContaining({
        status: 400,
        message: 'privateKey is not a valid PEM private key',
      }),
    );
  });

  it.each([1024, 4224])('rejects a %i-bit RSA key with a 400', (bits) => {
    const pem = generateKeyPairSync('rsa', { modulusLength: bits }).privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;
    expect(() => githubAppJwt('1', pem)).toThrow(
      expect.objectContaining({
        status: 400,
        message: 'privateKey must be a 2048- to 4096-bit RSA key',
      }),
    );
  });

  it('accepts a 4096-bit RSA key', () => {
    const pem = generateKeyPairSync('rsa', { modulusLength: 4096 }).privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;
    expect(githubAppJwt('1', pem).split('.')).toHaveLength(3);
  });
});
