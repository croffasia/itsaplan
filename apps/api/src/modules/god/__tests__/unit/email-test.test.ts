import { describe, expect, it } from 'bun:test';
import { emailTestError } from '../../email-test';

describe('emailTestError', () => {
  it('maps transport timeouts without exposing their details', () => {
    expect(emailTestError('Connection timeout to smtp.internal:587')).toBe(
      'The email provider timed out',
    );
  });

  it('maps provider rate limits', () => {
    expect(emailTestError('HTTP 429: rate limit exceeded')).toBe(
      'The email provider rate limit or quota was reached',
    );
  });

  it('maps authentication failures', () => {
    expect(emailTestError('SMTP 535: invalid login')).toBe(
      'The email provider rejected the credentials',
    );
  });

  it('maps an unverified sender domain', () => {
    expect(emailTestError('Resend HTTP 403: The example.com domain is not verified')).toBe(
      'The email provider rejected the From address',
    );
  });

  it('does not mistake an arbitrary host name for a sender-domain failure', () => {
    expect(emailTestError('getaddrinfo ENOTFOUND smtp.domain.example')).toBe(
      'The email provider rejected the test message',
    );
  });
});
