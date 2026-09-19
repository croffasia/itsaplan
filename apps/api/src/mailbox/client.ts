import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { emailBody, sendEmail, verifySmtp, type SmtpConfig } from '@repo/mailer';
import { HttpError } from '../shared/lib';
import type { MailboxConfig } from './store';
import { mailboxErrorDetails } from './error-details';

const CONNECTION_TIMEOUT_MS = 15_000;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_CHARS = 200_000;

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailMessageSummary {
  uid: number;
  messageId: string | null;
  from: MailAddress[];
  to: MailAddress[];
  subject: string;
  receivedAt: string;
  unread: boolean;
  size: number;
}

export interface MailMessage extends MailMessageSummary {
  replyTo: MailAddress[];
  body: string;
  truncated: boolean;
  attachments: { filename: string; contentType: string; size: number }[];
  references: string[];
}

// The folders offered in the dashboard, in the order they are shown. Zoho names
// them itself, so which path holds the sent copy is read from the server's
// special-use flags rather than guessed from the name.
export interface MailFolder {
  path: string;
  name: string;
  kind: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive' | 'other';
  total: number;
  unread: number;
}

export const INBOX = 'INBOX';

export interface SendMailboxMessage {
  to: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
}

function smtpConfig(config: MailboxConfig): SmtpConfig {
  return {
    enabled: true,
    host: config.smtpHost,
    port: config.smtpPort,
    encryption: config.smtpSecurity === 'ssl' ? 'ssl' : 'tls',
    username: config.username,
    password: config.password,
    timeout: 15,
  };
}

function imapClient(config: MailboxConfig): ImapFlow {
  return new ImapFlow({
    host: config.imapHost,
    port: 993,
    secure: true,
    auth: { user: config.username, pass: config.password },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: 30_000,
  });
}

async function closeClient(client: ImapFlow): Promise<void> {
  if (client.usable) {
    await client.logout().catch(() => client.close());
  } else {
    client.close();
  }
}

function addresses(value: unknown): MailAddress[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as { name?: unknown; address?: unknown };
    if (typeof item.address !== 'string') return [];
    return [{ name: typeof item.name === 'string' ? item.name : '', address: item.address }];
  });
}

function isoDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function summary(message: {
  uid: number;
  envelope?: {
    messageId?: string;
    from?: unknown;
    to?: unknown;
    subject?: string;
    date?: Date;
  };
  flags?: Set<string>;
  internalDate?: Date | string;
  size?: number;
}): MailMessageSummary {
  return {
    uid: message.uid,
    messageId: message.envelope?.messageId ?? null,
    from: addresses(message.envelope?.from),
    to: addresses(message.envelope?.to),
    subject: message.envelope?.subject || '(No subject)',
    receivedAt: isoDate(message.internalDate ?? message.envelope?.date),
    unread: !message.flags?.has('\\Seen'),
    size: message.size ?? 0,
  };
}

// Zoho refusing the credentials and Zoho being unreachable need different things
// from the reader, so the two are named apart. Neither carries Zoho's own response:
// only which of the two happened.
function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const detail = error as { authenticationFailed?: boolean; responseStatus?: string };
  return detail.authenticationFailed === true || detail.responseStatus === 'NO';
}

function connectionError(action: string, error: unknown, config: MailboxConfig): never {
  console.error(
    `[mailbox] ${action} failed:`,
    mailboxErrorDetails(error, config.password, config.username),
  );
  if (isAuthFailure(error)) {
    throw new HttpError(
      502,
      `Zoho refused the username and password on ${action.split(' ')[0]}. Use the full email address as the username, and an application-specific password. An alias cannot sign in: only a real mailbox can.`,
    );
  }
  throw new HttpError(502, `Zoho ${action} failed. Check the mailbox connection settings.`);
}

function parsedReferences(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

export async function verifyMailboxConnection(config: MailboxConfig): Promise<void> {
  const client = imapClient(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    lock.release();
  } catch (error) {
    connectionError('IMAP connection', error, config);
  } finally {
    await closeClient(client);
  }

  const result = await verifySmtp(smtpConfig(config));
  if (!result.ok) connectionError('SMTP connection', result.error, config);
}

const SPECIAL_USE: Record<string, MailFolder['kind']> = {
  '\\Sent': 'sent',
  '\\Drafts': 'drafts',
  '\\Junk': 'spam',
  '\\Trash': 'trash',
  '\\Archive': 'archive',
};

const FOLDER_ORDER: MailFolder['kind'][] = [
  'inbox',
  'sent',
  'drafts',
  'spam',
  'trash',
  'archive',
  'other',
];

export async function listMailboxFolders(config: MailboxConfig): Promise<MailFolder[]> {
  const client = imapClient(config);
  try {
    await client.connect();
    const folders: MailFolder[] = [];
    for (const entry of await client.list()) {
      // A container that holds only other folders cannot be opened.
      if (entry.flags?.has('\\Noselect')) continue;
      const kind =
        entry.path.toUpperCase() === INBOX
          ? 'inbox'
          : (SPECIAL_USE[entry.specialUse ?? ''] ?? 'other');
      const status = await client
        .status(entry.path, { messages: true, unseen: true })
        .catch(() => null);
      folders.push({
        path: entry.path,
        name: kind === 'inbox' ? 'Inbox' : (entry.name ?? entry.path),
        kind,
        total: status?.messages ?? 0,
        unread: status?.unseen ?? 0,
      });
    }
    return folders.sort(
      (a, b) =>
        FOLDER_ORDER.indexOf(a.kind) - FOLDER_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
    );
  } catch (error) {
    return connectionError('folder list', error, config);
  } finally {
    await closeClient(client);
  }
}

export async function listMailboxMessages(
  config: MailboxConfig,
  limit: number,
  folder: string,
): Promise<MailMessageSummary[]> {
  const client = imapClient(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder, { readOnly: true });
    try {
      const exists = client.mailbox && client.mailbox.exists ? client.mailbox.exists : 0;
      if (exists === 0) return [];
      const start = Math.max(1, exists - limit + 1);
      const messages = await client.fetchAll(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        size: true,
      });
      return messages.map(summary).reverse();
    } finally {
      lock.release();
    }
  } catch (error) {
    return connectionError('message sync', error, config);
  } finally {
    await closeClient(client);
  }
}

export async function getMailboxMessage(
  config: MailboxConfig,
  uid: number,
  folder: string,
): Promise<MailMessage> {
  const client = imapClient(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder, { readOnly: true });
    try {
      const message = await client.fetchOne(
        String(uid),
        {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          size: true,
          source: { start: 0, maxLength: MAX_SOURCE_BYTES },
        },
        { uid: true },
      );
      if (!message || !message.source) throw new HttpError(404, 'Email not found');
      const parsed = await simpleParser(message.source, {
        skipImageLinks: true,
        maxHtmlLengthToParse: MAX_SOURCE_BYTES,
      });
      const body = (parsed.text ?? '').slice(0, MAX_BODY_CHARS);
      return {
        ...summary(message),
        messageId: parsed.messageId ?? message.envelope?.messageId ?? null,
        replyTo: addresses(parsed.replyTo?.value),
        body,
        truncated:
          (message.size ?? 0) > MAX_SOURCE_BYTES || (parsed.text?.length ?? 0) > MAX_BODY_CHARS,
        attachments: parsed.attachments.map((attachment) => ({
          filename: attachment.filename || 'Attachment',
          contentType: attachment.contentType,
          size: attachment.size,
        })),
        references: parsedReferences(parsed.references),
      };
    } finally {
      lock.release();
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return connectionError('message load', error, config);
  } finally {
    await closeClient(client);
  }
}

export async function markMailboxMessageRead(
  config: MailboxConfig,
  uid: number,
  folder: string,
): Promise<void> {
  const client = imapClient(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } catch (error) {
    connectionError('read-status update', error, config);
  } finally {
    await closeClient(client);
  }
}

export async function sendMailboxMessage(
  config: MailboxConfig,
  message: SendMailboxMessage,
): Promise<void> {
  const content = emailBody(message.body);
  const result = await sendEmail(
    { smtp: smtpConfig(config), resend: { enabled: false, apiKey: '' }, from: config.email },
    {
      to: message.to.join(', '),
      subject: message.subject,
      ...content,
      inReplyTo: message.inReplyTo,
      references: message.references,
    },
  );
  if (!result.ok) connectionError('send', result.error, config);
}
