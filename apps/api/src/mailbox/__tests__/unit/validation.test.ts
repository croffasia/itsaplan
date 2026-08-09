import { describe, expect, it } from 'bun:test';
import { normalizeMailboxInput, validateMessageHeaders } from '../../validation';

const valid = {
  email: 'Owner@Example.com ',
  username: 'owner@example.com',
  password: 'secret',
  imapHost: 'imappro.zoho.eu',
  smtpHost: 'smtppro.zoho.eu',
  smtpPort: 465 as const,
  smtpSecurity: 'ssl' as const,
};

describe('mailbox validation', () => {
  it('normalizes a secure Zoho configuration', () => {
    expect(normalizeMailboxInput(valid)).toMatchObject({
      email: 'owner@example.com',
      imapHost: 'imappro.zoho.eu',
      smtpHost: 'smtppro.zoho.eu',
    });
  });

  it('rejects non-Zoho hosts to prevent arbitrary outbound connections', () => {
    expect(() => normalizeMailboxInput({ ...valid, imapHost: '127.0.0.1' })).toThrow();
    expect(() => normalizeMailboxInput({ ...valid, smtpHost: 'smtp.example.com' })).toThrow();
  });

  it('requires the TLS mode that belongs to the SMTP port', () => {
    expect(() => normalizeMailboxInput({ ...valid, smtpPort: 587, smtpSecurity: 'ssl' })).toThrow();
  });

  it('rejects line breaks in message headers', () => {
    expect(() => validateMessageHeaders('Safe subject', '<safe@example.com>')).not.toThrow();
    expect(() => validateMessageHeaders('Hello\r\nBcc: victim@example.com')).toThrow();
  });
});
