import { t } from 'elysia';
import { REGISTRATION_MODES } from '@repo/auth';
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
  // The settings that depend on outbound email cannot be turned on without a mail
  // provider, and the UI explains why.
  hasEmailProvider: t.Boolean(),
});

export const AuthSettingsBody = t.Object({
  registration: t.Optional(t.UnionEnum([...REGISTRATION_MODES])),
  requireEmailVerification: t.Optional(t.Boolean()),
  magicLink: t.Optional(t.Boolean()),
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

// The permission matrix as returned: for each resource, the create/edit/read/
// delete flags. Same shape as the roles API returns.
const PermissionMatrix = t.Record(t.String(), t.Record(t.String(), t.Boolean()));

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
        permissions: PermissionMatrix,
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
        permissions: PermissionMatrix,
        joinedAt: t.String(),
      }),
    ),
  }),
]);

export const InstanceProjectListResponse = t.Object({
  items: t.Array(InstanceProjectResponse),
  total: t.Number(),
});
