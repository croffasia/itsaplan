import { Elysia, t } from 'elysia';
import {
  REGISTRATION_MODES,
  GOOGLE_REDIRECT_URI,
  getAuthSettings,
  setAuthSettings,
  getEmailSettings,
  setEmailSettings,
  hasConfiguredEmailProvider,
  getGoogleSettings,
  setGoogleSettings,
} from '@repo/auth';
import { authContext } from '../shared/auth-context';
import { requireGod } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { noContent } from '../shared/http';
import { deleteProject } from '../projects/store';
import {
  USER_KINDS,
  deleteInstanceUser,
  getInstanceProject,
  getInstanceUser,
  listInstanceProjects,
  listInstanceUsers,
  verifyInstanceUserEmail,
} from './store';
import { getInstanceBotSettings, setInstanceBotSettings } from '../telegram/store';
import { getStorageSettings, setStorageSettings, StorageSettingsSchema } from '../settings/storage';
import { getHotkeySettings, setHotkeySettings, HotkeyCombosSchema } from '../settings/hotkeys';

// God mode: instance-wide administration, open only to the "god" user (the first
// registered account). It covers how people may register, the mail provider that
// sends authentication email, and the Google OAuth credentials. Invites are per
// project (project_invite), managed in the project's Members section — there is
// nothing instance-level to add here.
//
// The settings themselves are owned by @repo/auth, which reads them at sign-up and
// when sending mail; these routes only expose them over HTTP. Secrets are never
// returned — each is replaced by a boolean telling whether a value is stored.

const encryption = t.UnionEnum(['none', 'ssl', 'tls']);

const AuthSettingsResponse = t.Object({
  registration: t.UnionEnum([...REGISTRATION_MODES]),
  requireEmailVerification: t.Boolean(),
  magicLink: t.Boolean(),
  // Whether a mail provider is configured. The settings that depend on outbound
  // email cannot be turned on without one, and the UI explains why.
  hasEmailProvider: t.Boolean(),
});

const AuthSettingsBody = t.Object({
  registration: t.Optional(t.UnionEnum([...REGISTRATION_MODES])),
  requireEmailVerification: t.Optional(t.Boolean()),
  magicLink: t.Optional(t.Boolean()),
});

const EmailSettingsResponse = t.Object({
  smtp: t.Object({
    enabled: t.Boolean(),
    host: t.String(),
    port: t.Nullable(t.Number()),
    encryption,
    username: t.String(),
    hasPassword: t.Boolean(),
    timeout: t.Nullable(t.Number()),
  }),
  resend: t.Object({ enabled: t.Boolean(), hasApiKey: t.Boolean() }),
  from: t.String(),
  // Whether projects may deliver their notifications through this provider instead
  // of configuring one of their own.
  allowProjects: t.Boolean(),
});

const EmailSettingsBody = t.Object({
  smtp: t.Optional(
    t.Object({
      enabled: t.Boolean(),
      host: t.String(),
      port: t.Nullable(t.Integer({ minimum: 1, maximum: 65535 })),
      encryption,
      username: t.String(),
      password: t.Optional(t.String()),
      timeout: t.Nullable(t.Integer({ minimum: 1 })),
    }),
  ),
  resend: t.Optional(t.Object({ enabled: t.Boolean(), apiKey: t.Optional(t.String()) })),
  from: t.Optional(t.String()),
  allowProjects: t.Optional(t.Boolean()),
});

const GoogleSettingsResponse = t.Object({
  enabled: t.Boolean(),
  clientId: t.String(),
  hasClientSecret: t.Boolean(),
  // The value to register in the Google Cloud console. Derived from the API origin,
  // so the UI shows it rather than asking the owner to assemble it.
  redirectUri: t.String(),
});

const GoogleSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  clientId: t.Optional(t.String()),
  clientSecret: t.Optional(t.String()),
});

const StorageSettingsBody = t.Object({
  maxAttachmentMb: t.Optional(t.Integer({ minimum: 1, maximum: 10240 })),
  maxAvatarMb: t.Optional(t.Integer({ minimum: 1, maximum: 1024 })),
  attachmentMimeTypes: t.Optional(t.Array(t.String({ minLength: 1 }))),
  projectQuotaMb: t.Optional(t.Integer({ minimum: 0 })),
});

const TelegramSettingsResponse = t.Object({
  enabled: t.Boolean(),
  // Resolved from Telegram when the token is saved. Shown so the administrator can
  // confirm which bot the token belongs to, and used to build the link deep link.
  botUsername: t.String(),
  hasBotToken: t.Boolean(),
});

const TelegramSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  botToken: t.Optional(t.String()),
});

// One account in the instance user directory.
const InstanceUserResponse = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  image: t.Nullable(t.String()),
  emailVerified: t.Boolean(),
  role: t.String(),
  isAgent: t.Boolean(),
  providers: t.Array(t.String()),
  projectCount: t.Number(),
  lastSeenAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

// The permission matrix as returned: for each resource, the create/edit/read/
// delete flags. Same shape as the roles API returns.
const PermissionMatrix = t.Record(t.String(), t.Record(t.String(), t.Boolean()));

const InstanceUserDetailResponse = t.Composite([
  InstanceUserResponse,
  t.Object({
    projects: t.Array(
      t.Object({
        projectId: t.Number(),
        projectKey: t.String(),
        projectName: t.String(),
        role: t.UnionEnum(['owner', 'member']),
        roleId: t.Nullable(t.Number()),
        roleName: t.Nullable(t.String()),
        permissions: PermissionMatrix,
        ownerCount: t.Number(),
        joinedAt: t.String(),
      }),
    ),
  }),
]);

// One project in the instance project directory, with what it holds counted across
// its dependent tables.
const InstanceProjectResponse = t.Object({
  id: t.Number(),
  key: t.String(),
  name: t.String(),
  description: t.String(),
  mcpEnabled: t.Boolean(),
  memberCount: t.Number(),
  issueCount: t.Number(),
  archivedIssueCount: t.Number(),
  initiativeCount: t.Number(),
  dashboardCount: t.Number(),
  viewCount: t.Number(),
  agentCount: t.Number(),
  skillCount: t.Number(),
  toolCount: t.Number(),
  integrationCount: t.Number(),
  lastActivityAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

const InstanceProjectDetailResponse = t.Composite([
  InstanceProjectResponse,
  t.Object({
    members: t.Array(
      t.Object({
        userId: t.String(),
        name: t.String(),
        email: t.String(),
        image: t.Nullable(t.String()),
        isAgent: t.Boolean(),
        role: t.UnionEnum(['owner', 'member']),
        roleId: t.Nullable(t.Number()),
        roleName: t.Nullable(t.String()),
        permissions: PermissionMatrix,
        joinedAt: t.String(),
      }),
    ),
  }),
]);

export const godRoutes = new Elysia({ name: 'god', detail: { tags: ['God'] } })
  .use(authContext)
  // Every route in this plugin is instance administration, so the role check runs
  // once here instead of per route.
  .onBeforeHandle(({ user }) => {
    requireGod(user);
  })

  .get(
    '/god/auth-settings',
    async () => ({
      ...(await getAuthSettings()),
      hasEmailProvider: await hasConfiguredEmailProvider(),
    }),
    {
      response: { 200: AuthSettingsResponse, 401: ErrorResponse, 403: ErrorResponse },
      detail: {
        summary: 'Get authentication settings',
        description: 'Get the instance registration mode and email-dependent auth options.',
      },
    },
  )

  .put(
    '/god/auth-settings',
    async ({ body }) => {
      const ready = await hasConfiguredEmailProvider();
      // Verification mail and magic links have no way to reach the user without a
      // provider, so they cannot be turned on before one is configured.
      if (!ready && (body.requireEmailVerification || body.magicLink)) {
        throw new HttpError(400, 'Configure an email provider first');
      }
      const next = await setAuthSettings(body);
      return { ...next, hasEmailProvider: ready };
    },
    {
      body: AuthSettingsBody,
      response: {
        200: AuthSettingsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
      detail: {
        summary: 'Update authentication settings',
        description: 'Update the instance registration mode and email-dependent auth options.',
      },
    },
  )

  .get('/god/email-settings', () => getEmailSettings(), {
    response: { 200: EmailSettingsResponse, 401: ErrorResponse, 403: ErrorResponse },
    detail: {
      summary: 'Get instance email settings',
      description: 'Get the mail provider used for authentication email (secrets redacted).',
    },
  })

  .put('/god/email-settings', ({ body }) => setEmailSettings(body), {
    body: EmailSettingsBody,
    response: {
      200: EmailSettingsResponse,
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
    },
    detail: {
      summary: 'Update instance email settings',
      description: 'Update the mail provider used for authentication email.',
    },
  })

  .get(
    '/god/google-settings',
    async () => ({ ...(await getGoogleSettings()), redirectUri: GOOGLE_REDIRECT_URI }),
    {
      response: { 200: GoogleSettingsResponse, 401: ErrorResponse, 403: ErrorResponse },
      detail: {
        summary: 'Get Google sign-in settings',
        description: 'Get the Google OAuth credentials (the client secret redacted).',
      },
    },
  )

  .put(
    '/god/google-settings',
    async ({ body }) => {
      const current = await getGoogleSettings();
      const clientId = body.clientId ?? current.clientId;
      const hasClientSecret = (body.clientSecret?.length ?? 0) > 0 || current.hasClientSecret;
      // Turning it on without credentials would only offer a button that fails at
      // Google, so the same rule as the mail-dependent options applies here.
      if (body.enabled && (clientId.length === 0 || !hasClientSecret)) {
        throw new HttpError(400, 'Add the Google client ID and secret first');
      }
      const next = await setGoogleSettings(body);
      return { ...next, redirectUri: GOOGLE_REDIRECT_URI };
    },
    {
      body: GoogleSettingsBody,
      response: {
        200: GoogleSettingsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
      detail: {
        summary: 'Update Google sign-in settings',
        description: 'Update the Google OAuth credentials and whether Google sign-in is offered.',
      },
    },
  )

  .get('/god/storage-settings', () => getStorageSettings(), {
    response: { 200: StorageSettingsSchema, 401: ErrorResponse, 403: ErrorResponse },
    detail: {
      summary: 'Get storage limits',
      description: 'Get the instance upload limits: file sizes, accepted types, and project quota.',
    },
  })

  .put('/god/storage-settings', ({ body }) => setStorageSettings(body), {
    body: StorageSettingsBody,
    response: {
      200: StorageSettingsSchema,
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
    },
    detail: {
      summary: 'Update storage limits',
      description:
        'Update the instance upload limits. They apply to new uploads only; files already stored are untouched.',
    },
  })

  .get('/god/hotkey-settings', () => getHotkeySettings(), {
    response: { 200: HotkeyCombosSchema, 401: ErrorResponse, 403: ErrorResponse },
    detail: {
      summary: 'Get instance keyboard shortcuts',
      description:
        'Get the keyboard shortcut overrides that apply to everyone on this instance. A command left out uses the built-in binding.',
    },
  })

  .put('/god/hotkey-settings', ({ body }) => setHotkeySettings(body), {
    body: HotkeyCombosSchema,
    response: {
      200: HotkeyCombosSchema,
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
    },
    detail: {
      summary: 'Update instance keyboard shortcuts',
      description:
        'Replace the instance keyboard shortcut overrides. Each user may still rebind a shortcut for their own account.',
    },
  })

  .get('/god/telegram-settings', () => getInstanceBotSettings(), {
    response: { 200: TelegramSettingsResponse, 401: ErrorResponse, 403: ErrorResponse },
    detail: {
      summary: 'Get Telegram bot settings',
      description: 'Get the instance Telegram bot (the token redacted).',
    },
  })

  .put(
    '/god/telegram-settings',
    async ({ body }) => {
      const current = await getInstanceBotSettings();
      const hasBotToken = (body.botToken?.length ?? 0) > 0 || current.hasBotToken;
      // Without a token the bot can neither link accounts nor deliver, so turning it
      // on would only offer a button that leads nowhere.
      if (body.enabled && !hasBotToken) {
        throw new HttpError(400, 'Add the bot token first');
      }
      try {
        return await setInstanceBotSettings(body);
      } catch (err) {
        // A token Telegram rejects is the administrator's mistake, not a server
        // failure: report it as a bad request with what Telegram said.
        throw new HttpError(400, err instanceof Error ? err.message : 'Invalid bot token');
      }
    },
    {
      body: TelegramSettingsBody,
      response: {
        200: TelegramSettingsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
      detail: {
        summary: 'Update Telegram bot settings',
        description:
          'Update the instance Telegram bot token and whether the bot is in use. The token is verified with Telegram before it is stored.',
      },
    },
  )

  .get(
    '/god/users',
    ({ query }) =>
      listInstanceUsers({
        search: query.search,
        kind: query.kind ?? 'human',
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      }),
    {
      query: t.Object({
        search: t.Optional(t.String()),
        // Agent bot users are accounts too, but they are managed on a project's AI
        // Agents screen, so the directory lists people unless asked otherwise.
        kind: t.Optional(t.UnionEnum([...USER_KINDS])),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ items: t.Array(InstanceUserResponse), total: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
      detail: {
        summary: 'List instance users',
        description:
          'List one page of accounts, with the global role and sign-in state of each, plus how many match the filters.',
      },
    },
  )

  .get(
    '/god/users/:userId',
    async ({ params }) => {
      const found = await getInstanceUser(params.userId);
      if (!found) throw new HttpError(404, 'User not found');
      return found;
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: InstanceUserDetailResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get an instance user',
        description:
          'Get one account with the projects it can reach and the permissions its membership resolves to.',
      },
    },
  )

  .post(
    '/god/users/:userId/verify-email',
    async ({ params }) => {
      const updated = await verifyInstanceUserEmail(params.userId);
      if (!updated) throw new HttpError(404, 'User not found');
      return updated;
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: InstanceUserDetailResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Confirm a user email address',
        description:
          'Mark an account as email-confirmed without the user opening a confirmation link.',
      },
    },
  )

  .delete(
    '/god/users/:userId',
    async ({ params, query }) => {
      const target = await getInstanceUser(params.userId);
      if (!target) throw new HttpError(404, 'User not found');
      // An instance owner is not removable here: the role is what grants god mode,
      // so deleting one from inside it is how an instance loses its administration.
      if (target.role === 'god') throw new HttpError(403, 'An instance owner cannot be deleted');
      // An agent's bot user is created and removed with its AI Agent config.
      if (target.isAgent) {
        throw new HttpError(400, 'Delete the AI agent from its project instead');
      }
      // Projects this user owns alone. Their membership goes with the account, so
      // the project would be left with nobody who can manage it (god mode does not
      // bypass project membership). Either the caller takes those projects down
      // with the account, or the request is refused until another owner is added.
      const sole = target.projects.filter((p) => p.role === 'owner' && p.ownerCount === 1);
      if (sole.length > 0 && !query.withProjects) {
        throw new HttpError(
          400,
          `This user is the only owner of ${sole.map((p) => p.projectKey).join(', ')}. Add another owner first, or delete the projects with the account.`,
        );
      }
      if (query.withProjects) {
        for (const p of sole) await deleteProject(p.projectId);
      }
      await deleteInstanceUser(params.userId);
      return noContent();
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({
        // Delete the projects this user owns alone along with the account. Every
        // issue, comment and attachment in them goes too.
        withProjects: t.Optional(t.Boolean()),
      }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a user',
        description:
          'Remove an account from the instance, with its sessions, memberships and preferences. Optionally deletes the projects it owns alone.',
      },
    },
  )

  .get(
    '/god/projects',
    ({ query }) =>
      listInstanceProjects({
        search: query.search,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      }),
    {
      query: t.Object({
        search: t.Optional(t.String()),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ items: t.Array(InstanceProjectResponse), total: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
      detail: {
        summary: 'List instance projects',
        description:
          'List one page of projects with what each holds, plus how many match the search.',
      },
    },
  )

  .get(
    '/god/projects/:projectId',
    async ({ params }) => {
      const found = await getInstanceProject(params.projectId);
      if (!found) throw new HttpError(404, 'Project not found');
      return found;
    },
    {
      params: t.Object({ projectId: t.Numeric() }),
      response: {
        200: InstanceProjectDetailResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get an instance project',
        description:
          'Get one project with what it holds and every member, with the permissions each membership resolves to.',
      },
    },
  );
