import { describe, expect, it } from 'bun:test';
import { mailboxErrorDetails } from '../../error-details';

describe('mailboxErrorDetails', () => {
  it('keeps IMAP authentication, response, TLS, cause, and stderr details', () => {
    const cause = Object.assign(new Error('certificate verify failed'), {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      reason: 'unable to verify the first certificate',
      opensslErrorStack: ['error:0A000086:SSL routines::certificate verify failed'],
    });
    const error = Object.assign(new Error('Command failed'), {
      responseStatus: 'NO',
      responseText: 'LOGIN failed: authentication rejected',
      serverResponseCode: 'AUTHENTICATIONFAILED',
      authenticationFailed: true,
      stderr: 'TLS handshake rejected by server',
      cause,
    });

    expect(mailboxErrorDetails(error, 'mailbox-password')).toMatchObject({
      message: 'Command failed',
      responseStatus: 'NO',
      responseText: 'LOGIN failed: authentication rejected',
      serverResponseCode: 'AUTHENTICATIONFAILED',
      authenticationFailed: true,
      stderr: 'TLS handshake rejected by server',
      cause: {
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        reason: 'unable to verify the first certificate',
      },
    });
  });

  it('redacts the password, auth commands, and secret-like nested fields', () => {
    const password = 'never-log-this-password';
    const encodedPassword = Buffer.from(password).toString('base64');
    const error = Object.assign(new Error(`Login rejected for ${password}`), {
      executedCommand: `A1 LOGIN "owner@example.com" "${password}"`,
      response: { password, token: 'access-token', detail: `server echoed ${password}` },
      responseText: `Server echoed ${encodedPassword}`,
      stderr: `AUTHENTICATE PLAIN ${Buffer.from(`owner\0owner\0${password}`).toString('base64')}`,
    });

    const serialized = JSON.stringify(mailboxErrorDetails(error, password, 'owner'));
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain('access-token');
    expect(serialized).not.toContain(encodedPassword);
    expect(serialized).not.toContain(Buffer.from(`owner\0owner\0${password}`).toString('base64'));
    expect(serialized).toContain('[REDACTED]');
  });
});
