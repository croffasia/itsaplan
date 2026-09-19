import { createHash } from 'node:crypto';
import { Client, type ClientChannel } from 'ssh2';
import type { ServerCredential } from './store';

// How long a terminal session may stay open, and how long a connection attempt
// may take. A forgotten tab must not hold a shell on a customer's machine open
// for days.
export const SESSION_MAX_MS = 4 * 60 * 60 * 1000;
export const CONNECT_TIMEOUT_MS = 15_000;

export type SshFailure =
  'host_key_changed' | 'auth_failed' | 'unreachable' | 'timeout' | 'shell_failed';

export interface SshHandles {
  channel: ClientChannel;
  end: () => void;
}

// The OpenSSH-style fingerprint of a host key, so what is pinned here can be
// compared by eye with what `ssh-keyscan` or a provider's console shows.
export function hostKeyFingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}

// Maps ssh2's error text onto a small stable set. The raw message can name the
// host and the key type, so it is never handed to the browser.
function classify(error: Error & { level?: string }): SshFailure {
  const message = error.message.toLowerCase();
  if (error.level === 'client-authentication' || message.includes('authentication')) {
    return 'auth_failed';
  }
  if (message.includes('timed out') || message.includes('timeout')) return 'timeout';
  return 'unreachable';
}

export interface SshConnectResult {
  ok: true;
  handles: SshHandles;
  fingerprint: string;
}

export interface SshConnectFailure {
  ok: false;
  failure: SshFailure;
  fingerprint?: string;
}

// Opens an interactive shell. The host key is checked before the credential is
// offered: on a first connection the fingerprint is returned for the caller to
// pin, and on a later one a different key aborts the handshake, so a swapped host
// never receives the secret.
export function openShell(
  credential: ServerCredential,
  size: { cols: number; rows: number },
): Promise<SshConnectResult | SshConnectFailure> {
  return new Promise((resolve) => {
    const client = new Client();
    let seenFingerprint: string | undefined;
    let settled = false;

    const finish = (result: SshConnectResult | SshConnectFailure) => {
      if (settled) return;
      settled = true;
      if (!result.ok) client.end();
      resolve(result);
    };

    client.on('error', (error) => {
      finish({ ok: false, failure: classify(error as Error & { level?: string }) });
    });

    client.on('ready', () => {
      client.shell(
        { term: 'xterm-256color', cols: size.cols, rows: size.rows },
        (error, channel) => {
          if (error || !channel) {
            finish({ ok: false, failure: 'shell_failed' });
            return;
          }
          finish({
            ok: true,
            fingerprint: seenFingerprint ?? '',
            handles: { channel, end: () => client.end() },
          });
        },
      );
    });

    client.connect({
      host: credential.host,
      port: credential.port,
      username: credential.username,
      ...(credential.authType === 'password'
        ? { password: credential.secret }
        : {
            privateKey: credential.secret,
            ...(credential.passphrase ? { passphrase: credential.passphrase } : {}),
          }),
      readyTimeout: CONNECT_TIMEOUT_MS,
      keepaliveInterval: 20_000,
      hostVerifier: (key: Buffer) => {
        seenFingerprint = hostKeyFingerprint(key);
        if (!credential.hostKeyFingerprint) return true;
        if (credential.hostKeyFingerprint === seenFingerprint) return true;
        finish({ ok: false, failure: 'host_key_changed', fingerprint: seenFingerprint });
        return false;
      },
    });
  });
}
