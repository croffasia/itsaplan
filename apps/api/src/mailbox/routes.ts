import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import {
  getMailboxMessage,
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
import { normalizeMailboxInput, validateMessageHeaders } from './validation';

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
    '/projects/:projectKey/mailbox/messages',
    async ({ project, query }) => {
      const config = await requireMailbox(project.id);
      return listMailboxMessages(config, mailboxLimit(query.limit));
    },
    {
      permission: ['mail', 'read'],
      query: t.Object({ limit: t.Optional(t.Numeric()) }),
      response: {
        200: t.Array(MessageSummaryResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'List recent Zoho inbox messages' },
    },
  )

  .get(
    '/projects/:projectKey/mailbox/messages/:uid',
    async ({ project, params }) => {
      const config = await requireMailbox(project.id);
      return getMailboxMessage(config, requireUid(params.uid));
    },
    {
      permission: ['mail', 'read'],
      params: t.Object({ projectKey: t.String(), uid: t.Numeric() }),
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

  .post(
    '/projects/:projectKey/mailbox/messages/:uid/read',
    async ({ project, params }) => {
      const config = await requireMailbox(project.id);
      await markMailboxMessageRead(config, requireUid(params.uid));
      return noContent();
    },
    {
      permission: ['mail', 'edit'],
      params: t.Object({ projectKey: t.String(), uid: t.Numeric() }),
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
