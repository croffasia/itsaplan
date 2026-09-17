import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { EnvFile, getEnv, setEnv } from './env-file.ts';

const example = `# a comment
POSTGRES_USER=itsaplan
BETTER_AUTH_SECRET=change-me  # openssl rand -base64 32
# WEB_PORT=3001
`;

describe('getEnv', () => {
  test('reads a value and drops the trailing comment', () => {
    expect(getEnv(example, 'POSTGRES_USER')).toBe('itsaplan');
    expect(getEnv(example, 'BETTER_AUTH_SECRET')).toBe('change-me');
  });

  test('treats a commented-out key and an unknown key as unset', () => {
    expect(getEnv(example, 'WEB_PORT')).toBe('');
    expect(getEnv(example, 'NOPE')).toBe('');
  });
});

describe('setEnv', () => {
  test('replaces in place and leaves the other lines alone', () => {
    const written = setEnv(example, 'POSTGRES_USER', 'other');
    expect(getEnv(written, 'POSTGRES_USER')).toBe('other');
    expect(getEnv(written, 'BETTER_AUTH_SECRET')).toBe('change-me');
  });

  test('appends a key that is only present commented out', () => {
    expect(getEnv(setEnv(example, 'WEB_PORT', '3002'), 'WEB_PORT')).toBe('3002');
  });

  test('writes a generated secret literally, $ and all', () => {
    const secret = 'a$&b$1c/+=';
    expect(getEnv(setEnv(example, 'APP_ENCRYPTION_KEY', secret), 'APP_ENCRYPTION_KEY')).toBe(
      secret,
    );
  });
});

describe('EnvFile', () => {
  const tempPath = () => join(mkdtempSync(join(tmpdir(), 'env-file-')), '.env');

  const write = (body: string) => {
    const path = tempPath();
    writeFileSync(path, body);
    return new EnvFile(path);
  };

  test('generates over an example value and keeps a real one', () => {
    const env = write(
      'BETTER_AUTH_SECRET=change-me\nAPP_ENCRYPTION_KEY=\nS3_SECRET_ACCESS_KEY=kept\n',
    );
    ['BETTER_AUTH_SECRET', 'APP_ENCRYPTION_KEY', 'S3_SECRET_ACCESS_KEY'].forEach((key) =>
      env.generate(key),
    );

    expect(env.get('BETTER_AUTH_SECRET')).not.toBe('change-me');
    expect(env.get('APP_ENCRYPTION_KEY')).toHaveLength(44);
    expect(env.get('S3_SECRET_ACCESS_KEY')).toBe('kept');
  });

  test('fresh reads the example, ignoring the file next to it', () => {
    const path = tempPath();
    writeFileSync(path, 'POSTGRES_USER=vela\n');
    writeFileSync(`${path}.example`, 'POSTGRES_USER=itsaplan\n');

    expect(new EnvFile(path).get('POSTGRES_USER')).toBe('vela');
    expect(new EnvFile(path, true).get('POSTGRES_USER')).toBe('itsaplan');
  });
});
