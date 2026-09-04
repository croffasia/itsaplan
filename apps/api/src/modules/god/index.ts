import { Elysia, t } from 'elysia';
import {
  GOOGLE_REDIRECT_URI,
  OIDC_REDIRECT_URI,
  getAuthSettings,
  setAuthSettings,
  getEmailSettings,
  resolveEmailConfig,
  setEmailSettings,
  hasConfiguredEmailProvider,
  getGoogleSettings,
  setGoogleSettings,
  hasConfiguredGoogle,
  getOidcSettings,
  setOidcSettings,
  hasConfiguredOidc,
  getScimSettings,
  setScimSettings,
  rotateScimToken,
} from '@repo/auth';
import { emailBody, hasEmailProvider, sendEmail } from '@repo/mailer';
import { authContext } from '#shared/auth-context';
import { requireGod } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { noContent } from '#shared/http';
import { deleteProject } from '#modules/projects/service';
import {
  deleteInstanceUser,
  getInstanceProject,
  getInstanceUser,
  listInstanceProjects,
  listInstanceUsers,
  listScimGroups,
  setScimGroupMappings,
  verifyInstanceUserEmail,
} from './service';
import {
  AuthSettingsBody,
  AuthSettingsResponse,
  EmailSettingsBody,
  EmailSettingsResponse,
  EmailTestResponse,
  GoogleSettingsBody,
  GoogleSettingsResponse,
  InstanceProjectDetailResponse,
  InstanceProjectListResponse,
  InstanceUserDetailResponse,
  InstanceUserListResponse,
  OidcSettingsBody,
  OidcSettingsResponse,
  ScimGroupMappingsBody,
  ScimGroupResponse,
  ScimSettingsBody,
  ScimSettingsResponse,
  ScimTokenResponse,
  StorageSettingsBody,
  TelegramSettingsBody,
  TelegramSettingsResponse,
  deleteUserQuery,
  listProjectsQuery,
  listUsersQuery,
  projectParams,
  scimGroupParams,
  userParams,
} from './model';
import { emailTestError } from './email-test';
import { getInstanceBotSettings, setInstanceBotSettings } from '#modules/telegram/service';
import { SCIM_BASE_URL } from '#modules/scim/resource';
import {
  getStorageSettings,
  setStorageSettings,
  getHotkeySettings,
  setHotkeySettings,
  getProjectDefaults,
  setProjectDefaults,
} from '#modules/settings/service';
import { getUpdateStatus } from '#modules/settings/updates';
import {
  HotkeyCombosSchema,
  ProjectDefaultsSchema,
  StorageSettingsSchema,
  UpdateStatusSchema,
} from '#modules/settings/model';

// God mode: instance-wide administration, open only to the "god" user (the first
// registered account). It covers how people may register, the mail provider that
// sends authentication email, the OAuth credentials, and SCIM provisioning. Invites
// are per project (project_invite), managed in the project's Members section — there
// is nothing instance-level to add here.
//
// The settings themselves are owned by @repo/auth, which reads them at sign-up and
// when sending mail; these routes only expose them over HTTP. Secrets are never
// returned — each is replaced by a boolean telling whether a value is stored.

// Whether any single sign-on provider can run right now. Password sign-in may only
// be turned off while one can.
async function hasSsoProvider(): Promise<boolean> {
  return (await hasConfiguredOidc()) || (await hasConfiguredGoogle());
}

async function assertUsableSignInMethod(
  nextProviderUsable: boolean,
  otherProviderUsable: boolean,
): Promise<void> {
  const auth = await getAuthSettings();
  if (!auth.emailPassword && !nextProviderUsable && !otherProviderUsable) {
    throw new HttpError(400, 'Enable password sign-in or another single sign-on provider first');
  }
}

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
      hasSsoProvider: await hasSsoProvider(),
    }),
    {
      response: { 200: AuthSettingsResponse, ...errors(401, 403) },
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
      const sso = await hasSsoProvider();
      // Without another way in, turning the password form off would lock everyone
      // out, the instance owner included.
      if (body.emailPassword === false && !sso) {
        throw new HttpError(400, 'Configure a single sign-on provider first');
      }
      const next = await setAuthSettings(body);
      return { ...next, hasEmailProvider: ready, hasSsoProvider: sso };
    },
    {
      body: AuthSettingsBody,
      response: { 200: AuthSettingsResponse, ...errors(400, 401, 403) },
      detail: {
        summary: 'Update authentication settings',
        description: 'Update the instance registration mode and email-dependent auth options.',
      },
    },
  )

  .get('/god/email-settings', () => getEmailSettings(), {
    response: { 200: EmailSettingsResponse, ...errors(401, 403) },
    detail: {
      summary: 'Get instance email settings',
      description: 'Get the mail provider used for authentication email (secrets redacted).',
    },
  })

  .put('/god/email-settings', ({ body }) => setEmailSettings(body), {
    body: EmailSettingsBody,
    response: { 200: EmailSettingsResponse, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update instance email settings',
      description: 'Update the mail provider used for authentication email.',
    },
  })

  .post(
    '/god/email-settings/test',
    async ({ user, body: patch }) => {
      const current = requireGod(user);
      if (!current.email) throw new HttpError(400, 'The instance owner has no email address');
      const config = await resolveEmailConfig(patch ?? {});
      if (!hasEmailProvider(config)) {
        throw new HttpError(400, 'Configure an email provider first');
      }

      const body = emailBody(
        "This test confirms that It's a Plan can send email through the configured provider.",
      );
      const result = await sendEmail(
        { ...config, smtp: { ...config.smtp, timeout: config.smtp.timeout ?? 15 } },
        {
          to: current.email,
          subject: "It's a Plan email test",
          ...body,
        },
      );
      if (!result.ok) {
        console.error('[god] test email failed:', result.error);
        throw new HttpError(502, emailTestError(result.error));
      }
      return { recipient: current.email };
    },
    {
      body: t.Optional(EmailSettingsBody),
      response: { 200: EmailTestResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Send a test email',
        description:
          'Send a test message through the supplied provider settings without saving them.',
      },
    },
  )

  .get(
    '/god/google-settings',
    async () => ({ ...(await getGoogleSettings()), redirectUri: GOOGLE_REDIRECT_URI }),
    {
      response: { 200: GoogleSettingsResponse, ...errors(401, 403) },
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
      const enabled = body.enabled ?? current.enabled;
      const clientId = body.clientId ?? current.clientId;
      const hasClientSecret = (body.clientSecret?.length ?? 0) > 0 || current.hasClientSecret;
      // Turning it on without credentials would only offer a button that fails at
      // Google, so the same rule as the mail-dependent options applies here.
      if (enabled && (clientId.length === 0 || !hasClientSecret)) {
        throw new HttpError(400, 'Add the Google client ID and secret first');
      }
      await assertUsableSignInMethod(
        enabled && clientId.length > 0 && hasClientSecret,
        await hasConfiguredOidc(),
      );
      const next = await setGoogleSettings(body);
      return { ...next, redirectUri: GOOGLE_REDIRECT_URI };
    },
    {
      body: GoogleSettingsBody,
      response: { 200: GoogleSettingsResponse, ...errors(400, 401, 403) },
      detail: {
        summary: 'Update Google sign-in settings',
        description: 'Update the Google OAuth credentials and whether Google sign-in is offered.',
      },
    },
  )

  .get(
    '/god/oidc-settings',
    async () => ({ ...(await getOidcSettings()), redirectUri: OIDC_REDIRECT_URI }),
    {
      response: { 200: OidcSettingsResponse, ...errors(401, 403) },
      detail: {
        summary: 'Get OIDC sign-in settings',
        description: 'Get the generic OIDC/OAuth2 provider settings (the client secret redacted).',
      },
    },
  )

  .put(
    '/god/oidc-settings',
    async ({ body }) => {
      const current = await getOidcSettings();
      const enabled = body.enabled ?? current.enabled;
      const discoveryUrl = body.discoveryUrl ?? current.discoveryUrl;
      const clientId = body.clientId ?? current.clientId;
      const hasClientSecret = (body.clientSecret?.length ?? 0) > 0 || current.hasClientSecret;
      // Turning it on without credentials would only offer a button that fails at
      // the provider, the same rule the Google settings apply.
      if (enabled && (discoveryUrl.length === 0 || clientId.length === 0 || !hasClientSecret)) {
        throw new HttpError(400, 'Add the discovery URL, client ID and secret first');
      }
      await assertUsableSignInMethod(
        enabled && discoveryUrl.length > 0 && clientId.length > 0 && hasClientSecret,
        await hasConfiguredGoogle(),
      );
      const next = await setOidcSettings(body);
      return { ...next, redirectUri: OIDC_REDIRECT_URI };
    },
    {
      body: OidcSettingsBody,
      response: { 200: OidcSettingsResponse, ...errors(400, 401, 403) },
      detail: {
        summary: 'Update OIDC sign-in settings',
        description:
          'Update the generic OIDC/OAuth2 credentials and whether the provider is offered.',
      },
    },
  )

  .get(
    '/god/scim-settings',
    async () => ({ ...(await getScimSettings()), baseUrl: SCIM_BASE_URL }),
    {
      response: { 200: ScimSettingsResponse, ...errors(401, 403) },
      detail: {
        summary: 'Get SCIM provisioning settings',
        description: 'Get whether SCIM provisioning is on and whether a token has been generated.',
      },
    },
  )

  .put(
    '/god/scim-settings',
    async ({ body }) => {
      const current = await getScimSettings();
      // Enabling it without a token would leave the endpoint answering 401 to
      // everything, which reads as a broken integration rather than a missing step.
      if (body.enabled && !current.hasToken) {
        throw new HttpError(400, 'Generate a SCIM token first');
      }
      return { ...(await setScimSettings(body)), baseUrl: SCIM_BASE_URL };
    },
    {
      body: ScimSettingsBody,
      response: { 200: ScimSettingsResponse, ...errors(400, 401, 403) },
      detail: {
        summary: 'Update SCIM provisioning settings',
        description: 'Turn SCIM provisioning on or off.',
      },
    },
  )

  .post('/god/scim-settings/token', async () => ({ token: await rotateScimToken() }), {
    response: { 200: ScimTokenResponse, ...errors(401, 403) },
    detail: {
      summary: 'Generate a SCIM token',
      description:
        'Generate the bearer token an identity provider sends to /scim/v2, replacing any ' +
        'previous one. The value is returned once and cannot be read back.',
    },
  })

  .get('/god/scim-groups', () => listScimGroups(), {
    response: { 200: t.Array(ScimGroupResponse), ...errors(401, 403) },
    detail: {
      summary: 'List provisioned groups',
      description:
        'List the groups an identity provider has pushed, with their member counts and the ' +
        'projects they grant membership in.',
    },
  })

  .put(
    '/god/scim-groups/:groupId/mappings',
    ({ params, body }) => setScimGroupMappings(params.groupId, body.mappings),
    {
      params: scimGroupParams,
      body: ScimGroupMappingsBody,
      response: { 200: ScimGroupResponse, ...commonErrors },
      detail: {
        summary: "Set a group's project mappings",
        description:
          'Replace the list of projects a provisioned group grants membership in, then ' +
          'reconcile the membership of every project the change touched.',
      },
    },
  )

  .get('/god/storage-settings', () => getStorageSettings(), {
    response: { 200: StorageSettingsSchema, ...errors(401, 403) },
    detail: {
      summary: 'Get storage limits',
      description: 'Get the instance upload limits: file sizes, accepted types, and project quota.',
    },
  })

  .put('/god/storage-settings', ({ body }) => setStorageSettings(body), {
    body: StorageSettingsBody,
    response: { 200: StorageSettingsSchema, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update storage limits',
      description:
        'Update the instance upload limits. They apply to new uploads only; files already stored are untouched.',
    },
  })

  .get('/god/project-defaults', () => getProjectDefaults(), {
    response: { 200: ProjectDefaultsSchema, ...errors(401, 403) },
    detail: {
      summary: 'Get project defaults',
      description: 'Get what a newly created project starts with on this instance.',
    },
  })

  .put('/god/project-defaults', ({ body }) => setProjectDefaults(body), {
    body: ProjectDefaultsSchema,
    response: { 200: ProjectDefaultsSchema, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update project defaults',
      description:
        'Update what a newly created project starts with. Projects that already exist are untouched; each setting stays editable per project.',
    },
  })

  .get('/god/hotkey-settings', () => getHotkeySettings(), {
    response: { 200: HotkeyCombosSchema, ...errors(401, 403) },
    detail: {
      summary: 'Get instance keyboard shortcuts',
      description:
        'Get the keyboard shortcut overrides that apply to everyone on this instance. A command left out uses the built-in binding.',
    },
  })

  .put('/god/hotkey-settings', ({ body }) => setHotkeySettings(body), {
    body: HotkeyCombosSchema,
    response: { 200: HotkeyCombosSchema, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update instance keyboard shortcuts',
      description:
        'Replace the instance keyboard shortcut overrides. Each user may still rebind a shortcut for their own account.',
    },
  })

  // Whether a newer release is published, and the notes of the releases around the
  // running one. Owner-only: they are the one who upgrades the instance, and the
  // sidebar hides the indicator from everyone else. The version alone is readable by
  // any signed-in user (/settings/version).
  .get('/god/updates', () => getUpdateStatus(), {
    response: { 200: UpdateStatusSchema, ...errors(401, 403) },
    detail: {
      summary: 'Get the update status',
      description:
        'Get the running version, the newest published one, and the release notes. Every call reads the published releases upstream.',
    },
  })

  .post('/god/updates/check', () => getUpdateStatus(), {
    response: { 200: UpdateStatusSchema, ...errors(401, 403) },
    detail: {
      summary: 'Check for updates now',
      description:
        'Read the published releases on demand. Returns the update status either way: a failed check answers from the release history of this build.',
    },
  })

  .get('/god/telegram-settings', () => getInstanceBotSettings(), {
    response: { 200: TelegramSettingsResponse, ...errors(401, 403) },
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
      response: { 200: TelegramSettingsResponse, ...errors(400, 401, 403) },
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
      query: listUsersQuery,
      response: { 200: InstanceUserListResponse, ...errors(400, 401, 403) },
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
      params: userParams,
      response: { 200: InstanceUserDetailResponse, ...accessErrors },
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
      params: userParams,
      response: { 200: InstanceUserDetailResponse, ...accessErrors },
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
      params: userParams,
      query: deleteUserQuery,
      response: { 204: t.Void(), ...commonErrors },
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
      query: listProjectsQuery,
      response: { 200: InstanceProjectListResponse, ...errors(400, 401, 403) },
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
      params: projectParams,
      response: { 200: InstanceProjectDetailResponse, ...commonErrors },
      detail: {
        summary: 'Get an instance project',
        description:
          'Get one project with what it holds and every member, with the permissions each membership resolves to.',
      },
    },
  );
