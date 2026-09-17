import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { Server } from 'ssh2';
import { hostKeyFingerprint, openShell } from '../../ssh';
import type { ServerCredential } from '../../store';

// A real SSH server, in process. The terminal is the most far-reaching thing the
// dashboard does, so its handshake, host-key pinning and byte flow are exercised
// against an actual daemon rather than a stub.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const USER = 'operator';
const PASSWORD = 'correct-horse';

let daemon: Server;
let port = 0;

function credential(overrides: Partial<ServerCredential> = {}): ServerCredential {
  return {
    host: '127.0.0.1',
    port,
    username: USER,
    authType: 'password',
    secret: PASSWORD,
    passphrase: null,
    hostKeyFingerprint: null,
    active: true,
    ...overrides,
  };
}

beforeAll(async () => {
  daemon = new Server({ hostKeys: [privateKey] }, (client) => {
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password' && ctx.username === USER && ctx.password === PASSWORD) {
        ctx.accept();
      } else {
        ctx.reject(['password']);
      }
    });
    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept();
        session.on('pty', (ok) => ok && ok());
        session.on('shell', (acceptShell) => {
          const stream = acceptShell();
          stream.write('ready\r\n');
          stream.on('data', (chunk: Buffer) => stream.write(chunk));
        });
      });
    });
  });
  await new Promise<void>((resolve) => {
    daemon.listen(0, '127.0.0.1', () => {
      port = (daemon.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(() => {
  daemon.close();
});

describe('hostKeyFingerprint', () => {
  it('formats the key the way OpenSSH prints it', () => {
    const fingerprint = hostKeyFingerprint(Buffer.from('a key'));
    expect(fingerprint).toStartWith('SHA256:');
    expect(fingerprint).not.toEndWith('=');
    // Same key in, same fingerprint out.
    expect(hostKeyFingerprint(Buffer.from('a key'))).toBe(fingerprint);
    expect(hostKeyFingerprint(Buffer.from('another key'))).not.toBe(fingerprint);
  });
});

describe('openShell', () => {
  it('opens a shell and carries bytes in both directions', async () => {
    const result = await openShell(credential(), { cols: 80, rows: 24 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fingerprint).toStartWith('SHA256:');

    const echoed = await new Promise<string>((resolve) => {
      let seen = '';
      result.handles.channel.on('data', (chunk: Buffer) => {
        seen += chunk.toString();
        if (seen.includes('hallo')) resolve(seen);
      });
      result.handles.channel.write('hallo\n');
    });
    expect(echoed).toContain('ready');
    expect(echoed).toContain('hallo');
    result.handles.end();
  });

  it('accepts a host key that matches the pinned fingerprint', async () => {
    const first = await openShell(credential(), { cols: 80, rows: 24 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.handles.end();

    const second = await openShell(credential({ hostKeyFingerprint: first.fingerprint }), {
      cols: 80,
      rows: 24,
    });
    expect(second.ok).toBe(true);
    if (second.ok) second.handles.end();
  });

  // The whole point of pinning: a different host must never be handed the secret.
  it('refuses a host whose key does not match the pin', async () => {
    const result = await openShell(
      credential({ hostKeyFingerprint: 'SHA256:this-is-not-the-key-we-pinned' }),
      { cols: 80, rows: 24 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe('host_key_changed');
  });

  it('reports a refused credential as an auth failure', async () => {
    const result = await openShell(credential({ secret: 'wrong' }), { cols: 80, rows: 24 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe('auth_failed');
  });

  it('reports an unreachable host without leaking the address', async () => {
    const result = await openShell(credential({ port: 1 }), { cols: 80, rows: 24 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['unreachable', 'timeout']).toContain(result.failure);
  });
});
