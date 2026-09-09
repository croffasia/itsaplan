import { request } from '@/lib/api/core/client';
import type { MemberRole } from '@/lib/api/endpoints/members';
import type { TeamRole } from '@/lib/api/endpoints/teams';
import type { NotificationEncryption } from '@/lib/api/endpoints/notificationSettings';
import type { Permissions } from '@/lib/api/endpoints/roles';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';
import type {
  HotkeyOverrides,
  StorageSettings,
  StorageSettingsPatch,
} from '@/lib/api/endpoints/settings';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// Who may create an account on this instance.
export type RegistrationMode = 'open' | 'invite' | 'closed';

// The instance sign-in policy. hasEmailProvider tells whether outbound mail works;
// the options that depend on it cannot be turned on without one.
export interface InstanceAuthSettings {
  registration: RegistrationMode;
  requireEmailVerification: boolean;
  magicLink: boolean;
  emailPassword: boolean;
  trustProviderEmails: boolean;
  hasEmailProvider: boolean;
  // Whether Google or the OIDC provider can run. Password sign-in may only be turned
  // off while one of them can.
  hasSsoProvider: boolean;
}

export interface InstanceAuthSettingsPatch {
  registration?: RegistrationMode;
  requireEmailVerification?: boolean;
  magicLink?: boolean;
  emailPassword?: boolean;
  trustProviderEmails?: boolean;
}

// The instance mail provider used for authentication email (password reset, address
// verification, magic links). Separate from a team's notification provider.
// Secrets are never returned, only a `hasX` flag.
export interface InstanceEmailSettings {
  smtp: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: NotificationEncryption;
    username: string;
    hasPassword: boolean;
    timeout: number | null;
  };
  resend: { enabled: boolean; hasApiKey: boolean };
  from: string;
  // Whether projects may deliver their notifications through this provider.
  allowProjects: boolean;
}

export interface InstanceEmailSettingsPatch {
  smtp?: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: NotificationEncryption;
    username: string;
    password?: string;
    timeout: number | null;
  };
  resend?: { enabled: boolean; apiKey?: string };
  from?: string;
  allowProjects?: boolean;
}

export interface InstanceEmailTestResult {
  recipient: string;
}

// The Google OAuth credentials used for social sign-in. The client secret is never
// returned, only a `hasClientSecret` flag. redirectUri is derived from the API origin
// and has to be registered in the Google Cloud console.
export interface InstanceGoogleSettings {
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
}

export interface InstanceGoogleSettingsPatch {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
}

// The instance's generic OIDC/OAuth2 provider. The client secret is never returned,
// only a `hasClientSecret` flag. redirectUri is derived from the API origin and has
// to be registered with the identity provider.
export interface InstanceOidcSettings {
  enabled: boolean;
  label: string;
  discoveryUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  scopes: string[];
  pkce: boolean;
  redirectUri: string;
}

export interface InstanceOidcSettingsPatch {
  enabled?: boolean;
  label?: string;
  discoveryUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  pkce?: boolean;
}

// The instance Telegram bot: the one bot users link their accounts through, and the
// default sender for Telegram notifications. `botUsername` is resolved from Telegram
// when the token is saved.
export interface InstanceTelegramSettings {
  enabled: boolean;
  botUsername: string;
  hasBotToken: boolean;
}

export interface InstanceTelegramSettingsPatch {
  enabled?: boolean;
  botToken?: string;
}

// One account in the instance user directory. `role` is the global better-auth role
// ("god" for the instance owner), which is unrelated to project membership.
export interface InstanceUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  role: string;
  isAgent: boolean;
  providers: string[];
  projectCount: number;
  lastSeenAt: string | null;
  createdAt: string;
}

// A project the user can reach, with the permissions their membership resolves to
// (full for an owner, the assigned role's matrix for a member).
export interface InstanceUserProject {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: MemberRole;
  roleId: number | null;
  roleName: string | null;
  permissions: Permissions;
  // How many owners the project has. 1 on a project this user owns means deleting
  // the account would leave the project with nobody who can manage it.
  ownerCount: number;
  joinedAt: string;
}

export interface InstanceUserDetail extends InstanceUser {
  projects: InstanceUserProject[];
}

// Which accounts the directory lists: real people, the bot users behind AI agents,
// or both.
export type InstanceUserKind = 'human' | 'agent' | 'all';

// One project in the instance project directory, with what it holds counted across
// its dependent tables. `lastActivityAt` is the most recent entry in its issue feed.
export interface InstanceProject {
  id: number;
  key: string;
  name: string;
  description: string;
  mcpEnabled: boolean;
  memberCount: number;
  issueCount: number;
  archivedIssueCount: number;
  initiativeCount: number;
  dashboardCount: number;
  viewCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}

// One member of a project, with the permissions their membership resolves to (full
// for an owner, the assigned role's matrix for a member).
export interface InstanceProjectMember {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  isAgent: boolean;
  role: MemberRole;
  roleId: number | null;
  roleName: string | null;
  permissions: Permissions;
  description: string;
  timezone: string;
  joinedAt: string;
}

export interface InstanceProjectDetail extends InstanceProject {
  members: InstanceProjectMember[];
  // The custom roles a member of this project can be put on, for the SCIM group
  // mapping form.
  roles: { id: number; name: string; isDefault: boolean }[];
}

// One instance project as a picker entry: what the SCIM mapping form needs to name it.
export interface InstanceProjectOption {
  id: number;
  key: string;
  name: string;
}

// Instance administration (god mode). Every route below is owner-only; a plain
// user gets a 403, which is why the entries are hidden from the sidebar.
export const getInstanceAuthSettings = () => request<InstanceAuthSettings>('/god/auth-settings');

export const updateInstanceAuthSettings = (patch: InstanceAuthSettingsPatch) =>
  request<InstanceAuthSettings>('/god/auth-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

export const getInstanceEmailSettings = () => request<InstanceEmailSettings>('/god/email-settings');

export const updateInstanceEmailSettings = (patch: InstanceEmailSettingsPatch) =>
  request<InstanceEmailSettings>('/god/email-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

export const testInstanceEmailSettings = (patch: InstanceEmailSettingsPatch) =>
  request<InstanceEmailTestResult>('/god/email-settings/test', {
    method: 'POST',
    body: JSON.stringify(patch),
  });

export const getInstanceTelegramSettings = () =>
  request<InstanceTelegramSettings>('/god/telegram-settings');

export const updateInstanceTelegramSettings = (patch: InstanceTelegramSettingsPatch) =>
  request<InstanceTelegramSettings>('/god/telegram-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

export const getInstanceHotkeySettings = () => request<HotkeyOverrides>('/god/hotkey-settings');

export const updateInstanceHotkeySettings = (combos: HotkeyOverrides) =>
  request<HotkeyOverrides>('/god/hotkey-settings', {
    method: 'PUT',
    body: JSON.stringify(combos),
  });

export const getInstanceProjectDefaults = () => request<ProjectDefaults>('/god/project-defaults');

export const updateInstanceProjectDefaults = (body: ProjectDefaults) =>
  request<ProjectDefaults>('/god/project-defaults', {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// What applies to every team's agents on this instance.
export interface AgentSettings {
  // Days a run trace is kept for. 0 keeps traces until they are deleted by hand.
  traceRetentionDays: number;
}

export const getInstanceAgentSettings = () => request<AgentSettings>('/god/agent-settings');

export const updateInstanceAgentSettings = (body: AgentSettings) =>
  request<AgentSettings>('/god/agent-settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const getInstanceStorageSettings = () => request<StorageSettings>('/god/storage-settings');

export const updateInstanceStorageSettings = (patch: StorageSettingsPatch) =>
  request<StorageSettings>('/god/storage-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

export const getInstanceGoogleSettings = () =>
  request<InstanceGoogleSettings>('/god/google-settings');

export const updateInstanceGoogleSettings = (patch: InstanceGoogleSettingsPatch) =>
  request<InstanceGoogleSettings>('/god/google-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

export const getInstanceOidcSettings = () => request<InstanceOidcSettings>('/god/oidc-settings');

export const updateInstanceOidcSettings = (patch: InstanceOidcSettingsPatch) =>
  request<InstanceOidcSettings>('/god/oidc-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

// The instance user directory: one page of accounts, and one account with the
// projects it can reach. Search, the kind filter and paging all run on the server.
export const listInstanceUsers = (
  params: PageParams & { search?: string; kind: InstanceUserKind },
) =>
  request<Page<InstanceUser>>(
    `/god/users${pageQuery(params, { kind: params.kind, search: params.search })}`,
  );

export const getInstanceUser = (userId: string) =>
  request<InstanceUserDetail>(`/god/users/${userId}`);

export const verifyInstanceUserEmail = (userId: string) =>
  request<InstanceUserDetail>(`/god/users/${userId}/verify-email`, { method: 'POST' });

// `withProjects` takes down the projects the user owns alone; without it the API
// refuses to delete an account that would leave a project ownerless.
export const deleteInstanceUser = (userId: string, withProjects: boolean) =>
  request<void>(`/god/users/${userId}${withProjects ? '?withProjects=true' : ''}`, {
    method: 'DELETE',
  });

// The instance project directory: one page of projects, and one project with its
// members. Search and paging run on the server.
export const listInstanceProjects = (params: PageParams & { search?: string }) =>
  request<Page<InstanceProject>>(`/god/projects${pageQuery(params, { search: params.search })}`);

// Every project, for the SCIM mapping picker; the directory above is paged.
export const listInstanceProjectOptions = () =>
  request<InstanceProjectOption[]>('/god/projects/options');

export const getInstanceProject = (projectId: number) =>
  request<InstanceProjectDetail>(`/god/projects/${projectId}`);

// One team in the instance team directory, with what it holds counted across the
// tables the team owns and the projects it owns.
export interface InstanceTeam {
  id: number;
  name: string;
  mcpEnabled: boolean;
  memberCount: number;
  projectCount: number;
  issueCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
  roleCount: number;
  createdAt: string;
}

// One project the team owns, as the team panel lists it.
export interface InstanceTeamProject {
  id: number;
  key: string;
  name: string;
  mcpEnabled: boolean;
  memberCount: number;
  issueCount: number;
  createdAt: string;
}

// One member of a team. The role is the fixed team rank ('owner', 'manager',
// 'member', 'agent'), not a project role.
export interface InstanceTeamMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isAgent: boolean;
  role: TeamRole | 'agent';
  joinedAt: string;
}

// The instance team directory: one page of teams, and one team with its counts. The
// projects and the members of a team are paged apart, so a large team is never
// loaded whole.
export const listInstanceTeams = (params: PageParams & { search?: string }) =>
  request<Page<InstanceTeam>>(`/god/teams${pageQuery(params, { search: params.search })}`);

export const getInstanceTeam = (teamId: number) => request<InstanceTeam>(`/god/teams/${teamId}`);

export const listInstanceTeamProjects = (
  teamId: number,
  params: PageParams & { search?: string },
) =>
  request<Page<InstanceTeamProject>>(
    `/god/teams/${teamId}/projects${pageQuery(params, { search: params.search })}`,
  );

export const listInstanceTeamMembers = (teamId: number, params: PageParams & { search?: string }) =>
  request<Page<InstanceTeamMember>>(
    `/god/teams/${teamId}/members${pageQuery(params, { search: params.search })}`,
  );
