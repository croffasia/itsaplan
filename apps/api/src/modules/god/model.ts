import { t } from 'elysia';
import { REGISTRATION_MODES } from '@repo/auth';
import { PermissionMatrixSchema } from '#shared/permissions';
import { USER_KINDS } from './service';

const encryption = t.UnionEnum(['none', 'ssl', 'tls']);

export const userParams = t.Object({ userId: t.String() });

export const projectParams = t.Object({ projectId: t.Numeric() });

export const listUsersQuery = t.Object({
  search: t.Optional(t.String()),
  // Agent bot users are accounts too, but they are managed on a project's AI
  // Agents screen, so the directory lists people unless asked otherwise.
  kind: t.Optional(t.UnionEnum([...USER_KINDS])),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
  offset: t.Optional(t.Numeric({ minimum: 0 })),
});

export const listProjectsQuery = t.Object({
  search: t.Optional(t.String()),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
  offset: t.Optional(t.Numeric({ minimum: 0 })),
});

export const deleteUserQuery = t.Object({
  // Delete the projects this user owns alone along with the account. Every
  // issue, comment and attachment in them goes too.
  withProjects: t.Optional(t.Boolean()),
});

export const AuthSettingsResponse = t.Object({
  registration: t.UnionEnum([...REGISTRATION_MODES]),
  requireEmailVerification: t.Boolean(),
  magicLink: t.Boolean(),
  emailPassword: t.Boolean(),
  // The settings that depend on outbound email cannot be turned on without a mail
  // provider, and the UI explains why.
  hasEmailProvider: t.Boolean(),
  // Password sign-in cannot be turned off without another way in, and the UI
  // explains why.
  hasSsoProvider: t.Boolean(),
});

export const AuthSettingsBody = t.Object({
  registration: t.Optional(t.UnionEnum([...REGISTRATION_MODES])),
  requireEmailVerification: t.Optional(t.Boolean()),
  magicLink: t.Optional(t.Boolean()),
  emailPassword: t.Optional(t.Boolean()),
});

export const EmailSettingsResponse = t.Object({
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

export const EmailSettingsBody = t.Object({
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

export const EmailTestResponse = t.Object({ recipient: t.String() });

export const GoogleSettingsResponse = t.Object({
  enabled: t.Boolean(),
  clientId: t.String(),
  hasClientSecret: t.Boolean(),
  // The value to register in the Google Cloud console. Derived from the API origin,
  // so the UI shows it rather than asking the owner to assemble it.
  redirectUri: t.String(),
});

export const GoogleSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  clientId: t.Optional(t.String()),
  clientSecret: t.Optional(t.String()),
});

export const OidcSettingsResponse = t.Object({
  enabled: t.Boolean(),
  label: t.String(),
  discoveryUrl: t.String(),
  clientId: t.String(),
  hasClientSecret: t.Boolean(),
  scopes: t.Array(t.String()),
  pkce: t.Boolean(),
  // The value to register with the identity provider. Derived from the API origin,
  // so the UI shows it rather than asking the owner to assemble it.
  redirectUri: t.String(),
});

export const OidcSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  label: t.Optional(t.String({ maxLength: 60 })),
  discoveryUrl: t.Optional(t.String({ maxLength: 2048 })),
  clientId: t.Optional(t.String({ maxLength: 512 })),
  clientSecret: t.Optional(t.String({ maxLength: 512 })),
  scopes: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 64 }), { maxItems: 32 })),
  pkce: t.Optional(t.Boolean()),
});

export const ScimSettingsResponse = t.Object({
  enabled: t.Boolean(),
  hasToken: t.Boolean(),
  tokenPrefix: t.String(),
  // Where to point the identity provider. Derived from the API origin, like the
  // OIDC redirect URI.
  baseUrl: t.String(),
});

export const ScimSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
});

// The generated token, returned once. It is not stored anywhere it can be read
// back, so a lost token is replaced rather than recovered.
export const ScimTokenResponse = t.Object({
  token: t.String(),
});

const scimGroupMapping = t.Object({
  projectId: t.Integer(),
  role: t.UnionEnum(['owner', 'member']),
  // Which project_role a member joins on. Null for an owner (owners bypass the
  // permission matrix) or to fall back to the project's default role.
  roleId: t.Nullable(t.Integer()),
});

export const ScimGroupResponse = t.Object({
  id: t.String(),
  displayName: t.String(),
  externalId: t.Nullable(t.String()),
  memberCount: t.Integer(),
  mappings: t.Array(
    t.Intersect([scimGroupMapping, t.Object({ projectKey: t.String(), projectName: t.String() })]),
  ),
});

export const ScimGroupMappingsBody = t.Object({
  mappings: t.Array(scimGroupMapping, { maxItems: 100 }),
});

export const scimGroupParams = t.Object({ groupId: t.String() });

export const StorageSettingsBody = t.Object({
  maxAttachmentMb: t.Optional(t.Integer({ minimum: 1, maximum: 10240 })),
  maxAvatarMb: t.Optional(t.Integer({ minimum: 1, maximum: 1024 })),
  attachmentMimeTypes: t.Optional(t.Array(t.String({ minLength: 1 }))),
  projectQuotaMb: t.Optional(t.Integer({ minimum: 0 })),
});

export const TelegramSettingsResponse = t.Object({
  enabled: t.Boolean(),
  // Resolved from Telegram when the token is saved. Shown so the administrator can
  // confirm which bot the token belongs to, and used to build the link deep link.
  botUsername: t.String(),
  hasBotToken: t.Boolean(),
});

export const TelegramSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  botToken: t.Optional(t.String()),
});

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

export const InstanceUserDetailResponse = t.Composite([
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
        permissions: PermissionMatrixSchema,
        ownerCount: t.Number(),
        joinedAt: t.String(),
      }),
    ),
  }),
]);

export const InstanceUserListResponse = t.Object({
  items: t.Array(InstanceUserResponse),
  total: t.Number(),
});

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

export const InstanceProjectDetailResponse = t.Composite([
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
        permissions: PermissionMatrixSchema,
        joinedAt: t.String(),
      }),
    ),
    roles: t.Array(t.Object({ id: t.Integer(), name: t.String(), isDefault: t.Boolean() })),
  }),
]);

export const InstanceProjectListResponse = t.Object({
  items: t.Array(InstanceProjectResponse),
  total: t.Number(),
});
