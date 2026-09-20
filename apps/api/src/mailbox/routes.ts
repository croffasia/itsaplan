import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import {
  INBOX,
  getMailboxAttachment,
  getMailboxMessage,
  listMailboxFolders,
  listMailboxMessages,
  markMailboxMessageRead,
  sendMailboxMessage,
  verifyMailboxConnection,
} from './client';
import {
  deleteMailboxConfig,
  getMailboxConfig,
  getMailboxSettings,
  resolveMailboxConfig,
  saveMailboxConfig,
} from './store';
import { assertFolderName, normalizeMailboxInput, validateMessageHeaders } from './validation';
import { generateMailAssistance, mailSummary } from './ai';

const SmtpSecurity = t.Union([t.Literal('ssl'), t.Literal('starttls')]);
const SmtpPort = t.Union([t.Literal(465), t.Literal(587)]);

const MailboxSettingsResponse = t.Object({
  connected: t.Boolean(),
  email: t.String(),
  username: t.String(),
  hasPassword: t.Boolean(),
  imapHost: t.String(),
  smtpHost: t.String(),
  smtpPort: SmtpPort,
  smtpSecurity: SmtpSecurity,
});

const FolderResponse = t.Object({
  path: t.String(),
  name: t.String(),
  kind: t.Union([
    t.Literal('inbox'),
    t.Literal('sent'),
    t.Literal('drafts'),
    t.Literal('spam'),
    t.Literal('trash'),
    t.Literal('archive'),
    t.Literal('other'),
  ]),
  total: t.Number(),
  unread: t.Number(),
});

// Which folder a request is about. Left out, it is the inbox, so an older client
// keeps working unchanged.
const FolderQuery = t.Optional(t.String({ minLength: 1, maxLength: 255 }));

const MailboxSettingsBody = t.Object({
  email: t.String({ format: 'email', maxLength: 320 }),
  username: t.String({ minLength: 1, maxLength: 320 }),
  password: t.Optional(t.String({ maxLength: 1024 })),
  imapHost: t.String({ minLength: 1, maxLength: 253 }),
  smtpHost: t.String({ minLength: 1, maxLength: 253 }),
  smtpPort: SmtpPort,
  smtpSecurity: SmtpSecurity,
});

const MailAddressResponse = t.Object({ name: t.String(), address: t.String() });
const MessageSummaryResponse = t.Object({
  uid: t.Number(),
  messageId: t.Nullable(t.String()),
  from: t.Array(MailAddressResponse),
  senderAvatarUrl: t.Nullable(t.String()),
  to: t.Array(MailAddressResponse),
  subject: t.String(),
  receivedAt: t.String(),
  unread: t.Boolean(),
  size: t.Number(),
});
const MessageResponse = t.Composite([
  MessageSummaryResponse,
  t.Object({
    replyTo: t.Array(MailAddressResponse),
    body: t.String(),
    truncated: t.Boolean(),
    attachments: t.Array(
      t.Object({ filename: t.String(), contentType: t.String(), size: t.Number() }),
    ),
    references: t.Array(t.String()),
  }),
]);

async function requireMailbox(projectId: number) {
  const config = await getMailboxConfig(projectId);
  if (!config) throw new HttpError(409, 'Connect a Zoho mailbox first');
  return config;
}

function requireUid(uid: number): number {
  if (!Number.isInteger(uid) || uid < 1) throw new HttpError(400, 'Invalid email UID');
  return uid;
}

function requireAttachmentIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0) throw new HttpError(400, 'Invalid attachment index');
  return index;
}

function mailboxLimit(limit?: number): number {
  const value = limit ?? 50;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new HttpError(400, 'Mailbox limit must be between 1 and 100');
  }
  return value;
}

export const mailboxRoutes = new Elysia({
  name: 'mailbox',
  detail: { tags: ['Mailbox'] },
})
  .use(authContext)
  .use(guards)
  .onAfterHandle(({ set }) => {
    set.headers['cache-control'] = 'no-store';
    set.headers['x-content-type-options'] = 'nosniff';
  })

  .get('/projects/:projectKey/mailbox/settings', ({ project }) => getMailboxSettings(project.id), {
    permission: ['mail', 'read'],
    response: {
      200: MailboxSettingsResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'Get redacted mailbox settings' },
  })

  .put(
    '/projects/:projectKey/mailbox/settings',
    async ({ project, body }) => {
      const input = normalizeMailboxInput(body);
      const config = await resolveMailboxConfig(project.id, input);
      if (!config.password) throw new HttpError(400, 'A Zoho application password is required');
      await verifyMailboxConnection(config);
      return saveMailboxConfig(project.id, config);
    },
    {
      projectOwner: true,
      body: MailboxSettingsBody,
      response: {
        200: MailboxSettingsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Verify and save a Zoho mailbox connection' },
    },
  )

  .delete(
    '/projects/:projectKey/mailbox/settings',
    async ({ project }) => {
      await deleteMailboxConfig(project.id);
      return noContent();
    },
    {
      projectOwner: true,
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Disconnect a project mailbox' },
    },
  )

  .get(
    '/projects/:projectKey/mailbox/folders',
    async ({ project }) => listMailboxFolders(await requireMailbox(project.id)),
    {
      permission: ['mail', 'read'],
      response: {
        200: t.Array(FolderResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'List the folders of the connected mailbox' },
    },
  )

  .get(
    '/projects/:projectKey/mailbox/messages',
    async ({ project, query }) => {
      const config = await requireMailbox(project.id);
      return listMailboxMessages(
        config,
        mailboxLimit(query.limit),
        assertFolderName(query.folder ?? INBOX),
      );
    },
    {
      permission: ['mail', 'read'],
      query: t.Object({ limit: t.Optional(t.Numeric()), folder: FolderQuery }),
      response: {
        200: t.Array(MessageSummaryResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'List recent messages in a folder' },
    },
  )

  .get(
    '/projects/:projectKey/mailbox/messages/:uid',
    async ({ project, params, query }) => {
      const config = await requireMailbox(project.id);
      return getMailboxMessage(
        config,
        requireUid(params.uid),
        assertFolderName(query.folder ?? INBOX),
      );
    },
    {
      permission: ['mail', 'read'],
      params: t.Object({ projectKey: t.String(), uid: t.Numeric() }),
      query: t.Object({ folder: FolderQuery }),
      response: {
        200: MessageResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Read a Zoho inbox message' },
    },
  )

  .get(
    '/projects/:projectKey/mailbox/messages/:uid/attachments/:index',
    async ({ project, params, query }) => {
      const config = await requireMailbox(project.id);
      const attachment = await getMailboxAttachment(
        config,
        requireUid(params.uid),
        requireAttachmentIndex(params.index),
        assertFolderName(query.folder ?? INBOX),
      );
      return new Response(attachment.content, {
        headers: {
          'Content-Type': attachment.contentType,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
    {
      permission: ['mail', 'read'],
      params: t.Object({ projectKey: t.String(), uid: t.Numeric(), index: t.Numeric() }),
      query: t.Object({ folder: FolderQuery }),
      detail: { summary: 'Open a PDF attachment from an email' },
    },
  )

  .post(
    '/projects/:projectKey/mailbox/messages/:uid/ai',
    async ({ project, params, query, body }) => {
      const config = await requireMailbox(project.id);
      const folder = assertFolderName(query.folder ?? INBOX);
      const uid = requireUid(params.uid);
      if (body.action === 'summary') {
        return { text: await mailSummary(project.id, config, uid, folder) };
      }

      const message = await getMailboxMessage(config, uid, folder);
      return { text: await generateMailAssistance(project.id, message, 'reply') };
    },
    {
      permission: ['mail', 'read'],
      params: t.Object({ projectKey: t.String(), uid: t.Numeric() }),
      query: t.Object({ folder: FolderQuery }),
      body: t.Object({ action: t.Union([t.Literal('summary'), t.Literal('reply')]) }),
      response: {
        200: t.Object({ text: t.String() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Generate an email summary or reply with OpenRouter' },
    },
  )

  .post(
    '/projects/:projectKey/mailbox/messages/:uid/read',
    async ({ project, params, query }) => {
      const config = await requireMailbox(project.id);
      await markMailboxMessageRead(
        config,
        requireUid(params.uid),
        assertFolderName(query.folder ?? INBOX),
      );
      return noContent();
    },
    {
      permission: ['mail', 'edit'],
      params: t.Object({ projectKey: t.String(), uid: t.Numeric() }),
      query: t.Object({ folder: FolderQuery }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Mark a Zoho message as read' },
    },
  )

  .post(
    '/projects/:projectKey/mailbox/messages',
    async ({ project, body, set }) => {
      validateMessageHeaders(body.subject, body.inReplyTo, body.references);
      const config = await requireMailbox(project.id);
      await sendMailboxMessage(config, body);
      set.status = 201;
      return { sent: true };
    },
    {
      permission: ['mail', 'create'],
      body: t.Object({
        to: t.Array(t.String({ format: 'email', maxLength: 320 }), {
          minItems: 1,
          maxItems: 10,
        }),
        subject: t.String({ minLength: 1, maxLength: 200 }),
        body: t.String({ minLength: 1, maxLength: 100_000 }),
        inReplyTo: t.Optional(t.String({ maxLength: 998 })),
        references: t.Optional(t.Array(t.String({ maxLength: 998 }), { maxItems: 50 })),
      }),
      response: {
        201: t.Object({ sent: t.Boolean() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Send or reply to an email through Zoho SMTP' },
    },
  );
