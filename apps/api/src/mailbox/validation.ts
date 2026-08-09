import { HttpError } from '../shared/lib';
import type { MailboxSettingsInput } from './store';

const ZOHO_REGIONS = '(?:com|eu|in|com\\.au|jp|ca|sa)';
const IMAP_HOST = new RegExp(`^(?:imap|imappro)\\.zoho\\.${ZOHO_REGIONS}$`, 'i');
const SMTP_HOST = new RegExp(`^(?:smtp|smtppro)\\.zoho\\.${ZOHO_REGIONS}$`, 'i');

export function normalizeMailboxInput(input: MailboxSettingsInput): MailboxSettingsInput {
  const normalized = {
    ...input,
    email: input.email.trim().toLowerCase(),
    username: input.username.trim(),
    imapHost: input.imapHost.trim().toLowerCase(),
    smtpHost: input.smtpHost.trim().toLowerCase(),
  };
  if (!IMAP_HOST.test(normalized.imapHost)) {
    throw new HttpError(400, 'Use the Zoho IMAP server shown in your Zoho Mail settings');
  }
  if (!SMTP_HOST.test(normalized.smtpHost)) {
    throw new HttpError(400, 'Use the Zoho SMTP server shown in your Zoho Mail settings');
  }
  if (
    (normalized.smtpPort === 465 && normalized.smtpSecurity !== 'ssl') ||
    (normalized.smtpPort === 587 && normalized.smtpSecurity !== 'starttls')
  ) {
    throw new HttpError(400, 'SMTP port 465 requires SSL and port 587 requires STARTTLS');
  }
  return normalized;
}

export function validateMessageHeaders(
  subject: string,
  inReplyTo?: string,
  references?: string[],
): void {
  const values = [subject, ...(inReplyTo ? [inReplyTo] : []), ...(references ?? [])];
  if (values.some((value) => /[\r\n]/.test(value))) {
    throw new HttpError(400, 'Invalid email headers');
  }
}
