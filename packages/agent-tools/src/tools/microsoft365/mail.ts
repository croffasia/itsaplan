import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { graphRequest, htmlToText, msCredential, msUser, recipients } from './client';

const MAX_BODY_CHARS = 20_000;

const user = z
  .string()
  .optional()
  .describe('Mailbox (email address) to use. Defaults to the credential default user.');

function address(raw: unknown): string | null {
  const one = raw as { emailAddress?: { address?: string; name?: string } } | undefined;
  const mail = one?.emailAddress;
  if (!mail?.address) return null;
  return mail.name && mail.name !== mail.address ? `${mail.name} <${mail.address}>` : mail.address;
}

export const microsoft365MailSearch: CustomToolEntry = {
  key: 'microsoft365_mail_search',
  label: 'Microsoft 365 Search Mail',
  scopes: ['Mail.Read'],
  description:
    'Search an Outlook mailbox. Omit the query for the newest messages. Returns each message with its id, which microsoft365_mail_read takes.',
  inputSchema: z.object({
    query: z.string().optional().describe('Words to search for in subject, body and sender.'),
    user,
    limit: z.number().int().min(1).max(50).optional().describe('How many messages (default 10).'),
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const params = new URLSearchParams({
      $top: String(Number(input.limit ?? 10)),
      $select: 'id,subject,from,receivedDateTime,bodyPreview,isRead,webLink',
    });
    const query = String(input.query ?? '').trim();
    if (query) params.set('$search', `"${query.replace(/"/g, '')}"`);
    else params.set('$orderby', 'receivedDateTime desc');
    const body = await graphRequest(cred, {
      path: `users/${msUser(cred, input.user)}/messages?${params}`,
      permission: 'Mail.Read',
    });
    return {
      messages: (body.value ?? []).map((m) => ({
        id: String(m.id ?? ''),
        subject: m.subject ?? '',
        from: address(m.from),
        received: m.receivedDateTime ?? null,
        preview: m.bodyPreview ?? '',
        isRead: m.isRead ?? null,
        webLink: m.webLink ?? null,
      })),
    };
  },
};

export const microsoft365MailRead: CustomToolEntry = {
  key: 'microsoft365_mail_read',
  label: 'Microsoft 365 Read Mail',
  scopes: ['Mail.Read'],
  description: 'Read one Outlook message in full: sender, recipients and body as text.',
  inputSchema: z.object({
    messageId: z.string().min(1).describe('The message id from microsoft365_mail_search.'),
    user,
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const m = await graphRequest(cred, {
      path: `users/${msUser(cred, input.user)}/messages/${encodeURIComponent(String(input.messageId))}`,
      permission: 'Mail.Read',
    });
    const content = m.body as { contentType?: string; content?: string } | undefined;
    const raw = content?.content ?? '';
    const text = content?.contentType === 'html' ? htmlToText(raw) : raw;
    return {
      id: String(m.id ?? ''),
      subject: m.subject ?? '',
      from: address(m.from),
      to: ((m.toRecipients as unknown[]) ?? []).map(address).filter(Boolean),
      cc: ((m.ccRecipients as unknown[]) ?? []).map(address).filter(Boolean),
      received: m.receivedDateTime ?? null,
      body: text.slice(0, MAX_BODY_CHARS),
      truncated: text.length > MAX_BODY_CHARS,
      webLink: m.webLink ?? null,
    };
  },
};

export const microsoft365MailSend: CustomToolEntry = {
  key: 'microsoft365_mail_send',
  writes: true,
  label: 'Microsoft 365 Send Mail',
  scopes: ['Mail.Send'],
  description:
    "Send an email from an Outlook mailbox. The message is saved in that mailbox's Sent Items.",
  inputSchema: z.object({
    to: z.array(z.email()).min(1).describe('Recipient email addresses.'),
    cc: z.array(z.email()).optional().describe('Cc addresses.'),
    subject: z.string().min(1).describe('Subject line.'),
    body: z.string().min(1).describe('Message body as plain text.'),
    user: z
      .string()
      .optional()
      .describe('Mailbox to send from. Defaults to the credential default user.'),
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    await graphRequest(cred, {
      method: 'POST',
      path: `users/${msUser(cred, input.user)}/sendMail`,
      permission: 'Mail.Send',
      json: {
        message: {
          subject: String(input.subject),
          body: { contentType: 'text', content: String(input.body) },
          toRecipients: recipients(input.to),
          ...(input.cc ? { ccRecipients: recipients(input.cc) } : {}),
        },
        saveToSentItems: true,
      },
    });
    return { sent: true, to: input.to, subject: input.subject };
  },
};
