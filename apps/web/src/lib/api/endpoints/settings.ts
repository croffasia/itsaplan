import { request } from '@/lib/api/core/client';
import type { RegistrationMode } from '@/lib/api/endpoints/god';

// Per-project auto-archive thresholds: days an issue may sit inactive in a
// completed/canceled column before the worker archives it. null disables archiving
// for that state group. A new project starts at 28 completed / 7 canceled days.
export interface AutoArchiveSettings {
  completedDays: number | null;
  canceledDays: number | null;
}

// Which estimate kinds a project's issues carry and whether its members log the
// time they spend, all off by default. One turned off hides its UI and keeps what
// the issues already carry.
export interface EstimateSettings {
  points: boolean;
  time: boolean;
  logging: boolean;
}

// Per-project subtask automations, both off by default. completeParent closes a
// parent once all its subtasks are closed; closeSubtasks closes the remaining
// subtasks of a closed parent. Only closing is synchronized — an issue moving
// between open states leaves the rest of the hierarchy alone.
export interface SubtaskAutomationSettings {
  completeParent: boolean;
  closeSubtasks: boolean;
}

// Which optional sections a project shows. All on by default; turning one off
// hides its navigation entry and its section, keeping the rows behind it.
export interface ProjectFeatures {
  initiatives: boolean;
  cycles: boolean;
  dashboards: boolean;
  documents: boolean;
  notes: boolean;
  subtasks: boolean;
  checklists: boolean;
  issueStats: boolean;
}

// A project's settings: MCP reachability, which is read-only here, and the enabled
// sections.
export interface ProjectSettings {
  mcpEnabled: boolean;
  teamMcpEnabled: boolean;
  features: ProjectFeatures;
}

export interface StorageSettings {
  maxAttachmentMb: number;
  maxAvatarMb: number;
  // Accepted attachment content types: a full type ('application/pdf') or a
  // wildcard ('image/*'). Empty means any type is accepted.
  attachmentMimeTypes: string[];
  // Stored attachment bytes allowed per project, in MB. 0 means unlimited.
  projectQuotaMb: number;
}

export type StorageSettingsPatch = Partial<StorageSettings>;

// Rebound keyboard shortcuts: the combination each overridden command id takes. A
// command left out keeps the binding from the layer below.
export type HotkeyOverrides = Record<string, string>;

// What the sign-in and sign-up screens read before there is a session. magicLink,
// requireEmailVerification and google are already resolved against their provider by
// the API, so a screen can trust them without checking the credentials itself.
export interface PublicAuthConfig {
  registration: RegistrationMode;
  magicLink: boolean;
  requireEmailVerification: boolean;
  emailEnabled: boolean;
  // Whether the email/password form is offered at all. False only on an instance
  // that has a working single sign-on provider.
  emailPassword: boolean;
  google: boolean;
  oidc: boolean;
  // The sign-in button text the operator gave their identity provider. Empty when
  // OIDC is not offered, or when they left it blank.
  oidcLabel: string;
}

// Project settings: MCP reachability and the enabled sections. Owner-only; the
// current state comes with the project payload (getProject), so there is no read
// here.
export const updateProjectSettings = (
  projectKey: string,
  patch: { features?: Partial<ProjectFeatures> },
) =>
  request<ProjectSettings>(`/projects/${projectKey}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

// The workflow configuration (workflow_config: read to view, edit to change):
// the auto-archive thresholds, the subtask automations, and the estimate kinds.
// The estimate kinds have no read of their own — they come with the project.
export const getAutoArchive = (projectKey: string) =>
  request<AutoArchiveSettings>(`/projects/${projectKey}/settings/auto-archive`);

export const updateAutoArchive = (projectKey: string, input: AutoArchiveSettings) =>
  request<AutoArchiveSettings>(`/projects/${projectKey}/settings/auto-archive`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const getSubtaskAutomation = (projectKey: string) =>
  request<SubtaskAutomationSettings>(`/projects/${projectKey}/settings/subtasks`);

export const updateSubtaskAutomation = (projectKey: string, input: SubtaskAutomationSettings) =>
  request<SubtaskAutomationSettings>(`/projects/${projectKey}/settings/subtasks`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const updateEstimates = (projectKey: string, input: EstimateSettings) =>
  request<EstimateSettings>(`/projects/${projectKey}/settings/estimates`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

// The upload limits. The read is open to any signed-in user (the upload UI shows
// the limit); the write is god mode.
export const getStorageSettings = () => request<StorageSettings>('/settings/storage');

// The instance keyboard shortcuts. The read is open to any signed-in user (every
// client applies them); the write is god mode.
export const getHotkeySettings = () => request<HotkeyOverrides>('/settings/hotkeys');

// The instance's own sign-in policy, readable without a session: the sign-up
// screen needs it before an account exists.
export const getAuthConfig = () => request<PublicAuthConfig>('/auth-config');
