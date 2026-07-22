// Typed client for the planner API (apps/api/src/planner). Row shapes mirror the
// store DTOs. The API is a separate service; the browser reaches it at
// NEXT_PUBLIC_API_URL. The planner routes require a better-auth session, so every
// request sends credentials (the session cookie).

import type { FilterSet } from '@/utils/filters';
import type { SavedViewDisplay } from '@/utils/viewSettings';
import type { DashboardLayout, BreakdownBy } from '@/utils/dashboardWidgets';

// NEXT_PUBLIC_* is inlined at build time, so a build without it ships a client
// that cannot reach the API. Fail at import instead of pointing at a wrong origin.
export const API_URL = process.env.NEXT_PUBLIC_API_URL as string;
if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set');

// Resolves a possibly-relative API path (e.g. a stored avatar/attachment URL) to
// an absolute one against the API origin. Leaves absolute URLs untouched.
export function resolveApiUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

// An error carrying the HTTP status so callers can tell apart 401 (no session),
// 403 (no access to the project / not owner), 404 (not found) and 400 (a
// validation or business-rule failure). `message` is the API's `{ error }` text
// when present, so existing consumers that read `error.message` keep working.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // Send the better-auth session cookie to the API (separate origin).
    credentials: 'include',
    // Never serve API reads from the HTTP cache — React Query owns caching, and a
    // browser-cached GET can return stale data after a mutation refetch.
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Project {
  id: number;
  key: string;
  name: string;
  description: string;
  // Whether this project is reachable through the MCP server. Toggled by an owner
  // on the MCP page; gates every MCP tool call scoped to the project.
  mcpEnabled: boolean;
  createdAt: string;
  // The caller's role in this project. Only present on the /projects list
  // response (used to gate owner-only actions like deletion); absent on the
  // create/copy responses.
  role?: MemberRole;
  // The caller's permission matrix in this project. Present only when the list is
  // requested with permissions (listProjects({ permissions: true })).
  permissions?: Permissions;
}

// Parts of a source project the copy can carry over, one key per project settings
// section. Passed to copyProject as an include map; omitted keys are not copied. The
// API force-enables dependencies (a view needs its states/types/labels/fields).
export type CopyProjectIncludeKey =
  | 'states'
  | 'issueTypes'
  | 'labels'
  | 'customFields'
  | 'views'
  | 'dashboards'
  | 'actions'
  | 'archive'
  | 'roles'
  | 'notificationProviders'
  | 'webhooks'
  | 'integrations'
  | 'tools'
  | 'skills'
  | 'agents'
  | 'schedules';

export type StateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface Column {
  id: number;
  projectId: number;
  name: string;
  stateType: StateType;
  color: string;
  position: number;
}

export interface IssueType {
  id: number;
  projectId: number;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  position: number;
}

export interface Label {
  id: number;
  projectId: number;
  // The group this label belongs to, or null when ungrouped.
  groupId: number | null;
  name: string;
  color: string;
}

// A container a label can belong to. Labels reference it by groupId.
export interface LabelGroup {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

export interface Assignee {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  kind: 'member' | 'agent';
  agentKind: 'external' | 'internal' | null;
}

// An AI agent on a project: a bot user plus its configuration. `kind` is
// 'external' (driven by an outside caller through the API) or 'internal' (run by
// the built-in runtime, so it carries provider/model/instructions/tools). Only an
// external agent has an API key: `apiKeyStart` is the non-secret prefix for display
// (null for internal), and the plaintext key is only returned once, on create and
// on regenerate.
export interface AiAgent {
  id: number;
  projectId: number;
  userId: string;
  name: string;
  username: string;
  kind: 'external' | 'internal';
  // The integration_credential (kind 'llm') the model runs on, or null.
  modelCredentialId: number | null;
  model: string | null;
  instructions: string | null;
  tools: string[];
  temperature: number | null;
  maxSteps: number | null;
  memoryEnabled: boolean;
  memoryLastMessages: number | null;
  // Internal-agent run triggers.
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  // External-agent authorization role (a project_role id, or null for the default).
  roleId: number | null;
  createdAt: string;
  apiKeyStart: string | null;
  // The integration key of the model credential (the provider, e.g. "openai"), or
  // null when no credential is set.
  modelProvider: string | null;
  // How many actions the agent can take (always-on read-only plus granted mutating),
  // and how many skills and configured tools are enabled.
  actionCount: number;
  skillCount: number;
  toolCount: number;
}

// One row of an agent's autonomous run history. Issue-triggered runs reference an
// issue; scheduled and manual runs do not.
export interface AgentRun {
  id: number;
  status: 'pending' | 'success' | 'failed';
  trigger: 'mention' | 'delegation' | 'schedule' | 'manual';
  issueId: number | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
  prompt: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
}

export interface AgentRunPage {
  items: AgentRun[];
  nextCursor: number | null;
}

export interface AgentSchedule {
  id: number;
  agentId: number;
  agentName: string;
  name: string;
  prompt: string;
  cron: string;
  timezone: 'UTC';
  status: 'active' | 'paused';
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: 'pending' | 'success' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentScheduleInput {
  agentId: number;
  name: string;
  prompt: string;
  cron: string;
  status?: 'active' | 'paused';
}

export interface AgentScheduleRun {
  id: number;
  status: 'pending' | 'success' | 'failed';
  trigger: 'schedule' | 'manual';
  prompt: string;
  attempts: number;
  lastError: string | null;
  output: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

// One work-item tool from the server-side catalog. `key` is stored on the agent
// (grantable actions only); label/description are for the picker. `always` marks the
// read-only tools that are always granted and shown non-editable.
export interface AgentTool {
  key: string;
  label: string;
  description: string;
  always: boolean;
}

export interface NewAiAgentInput {
  name: string;
  username: string;
  kind: 'external' | 'internal';
  modelCredentialId?: number | null;
  model?: string | null;
  instructions?: string | null;
  tools?: string[];
  temperature?: number | null;
  maxSteps?: number | null;
  memoryEnabled?: boolean;
  memoryLastMessages?: number | null;
  triggerOnMention?: boolean;
  triggerOnAssign?: boolean;
  roleId?: number | null;
}

export interface AiAgentPatch {
  name?: string;
  username?: string;
  modelCredentialId?: number | null;
  model?: string | null;
  instructions?: string | null;
  tools?: string[];
  temperature?: number | null;
  maxSteps?: number | null;
  memoryEnabled?: boolean;
  memoryLastMessages?: number | null;
  triggerOnMention?: boolean;
  triggerOnAssign?: boolean;
  roleId?: number | null;
}

// A field of an integration's credential form (from the catalog). `type` "secret"
// marks a value stored encrypted and shown masked.
export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number' | 'boolean';
  required: boolean;
  placeholder?: string;
  help?: string;
}

// An integration the project can store a credential for (server-side catalog). `kind`
// 'llm' is an AI provider (its models an agent runs on, no tools); 'tool' is a tool
// integration whose `tools` are configured on a credential.
export interface IntegrationMeta {
  key: string;
  label: string;
  kind: 'llm' | 'tool';
  credentialSchema: ConfigField[];
  tools: { key: string; label: string; description: string; scopes?: string[] }[];
}

// A model an LLM provider offers, from the models.dev registry.
export interface ProviderModel {
  id: string;
  name: string;
}

// A stored integration credential. `redacted` mirrors the stored credential with
// secret fields masked; the real secrets are never returned.
export interface IntegrationCredential {
  id: number;
  projectId: number;
  integrationKey: string;
  label: string | null;
  redacted: Record<string, unknown>;
  createdAt: string;
}

export interface NewCredentialInput {
  integrationKey: string;
  label?: string | null;
  credential: Record<string, unknown>;
}

export interface CredentialPatch {
  label?: string | null;
  // Only the fields being changed. Secret fields left out keep their stored value.
  credential?: Record<string, unknown>;
}

// A reference file of a skill (metadata only).
export interface SkillRef {
  path: string;
  s3Key: string;
  size: number;
}

// A skill in the project library: a SKILL.md plus optional reference files, given
// to internal agents. Content lives in the object store; this is the metadata.
export interface AgentSkill {
  id: number;
  projectId: number;
  name: string;
  description: string;
  source: 'upload' | 'inline' | 'github';
  sourceUrl: string | null;
  files: SkillRef[];
  createdAt: string;
}

export interface NewSkillInput {
  source: 'upload' | 'inline' | 'github';
  name?: string | null;
  description?: string | null;
  markdown?: string;
  sourceUrl?: string | null;
}

export interface SkillPatch {
  name?: string;
  description?: string;
  markdown?: string;
}

// A skill found at a GitHub URL by the discover endpoint. `url` is a ready-to-import
// link for that single skill.
export interface GithubSkillCandidate {
  name: string;
  description: string;
  subpath: string;
  url: string;
}

// A configured tool: a catalog tool (toolKey) bound to an integration credential,
// enriched with the credential's integration and label for display. (Distinct from
// AgentTool, which is a built-in capability tool in the agent's Actions list.)
export interface ConfiguredTool {
  id: number;
  projectId: number;
  toolKey: string;
  credentialId: number;
  integrationKey: string;
  credentialLabel: string | null;
  createdAt: string;
}

export interface NewConfiguredToolInput {
  toolKey: string;
  credentialId: number;
}

// One event of a streamed agent run (mirrors the API's AgentRunEvent). `text` is a
// chunk of the answer to append; `tool-start`/`tool-end` report a capability the
// agent is using, so the UI can show what it is doing; `done` ends the run with the
// conversation thread id; `error` reports a failure that happened mid-run.
export type AgentRunEvent =
  | { type: 'text'; value: string }
  | { type: 'tool-start'; toolCallId: string; toolName: string }
  | { type: 'tool-end'; toolCallId: string; toolName: string }
  | { type: 'done'; threadId: string | null }
  | { type: 'error'; message: string };

// One of the caller's saved chat conversations with an agent. `title` is the first
// prompt (truncated); null when it was never set.
export interface AiChatThread {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

// One restored message of a chat thread's transcript.
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

export interface AiChatMessagePage {
  items: AiChatMessage[];
  nextPage: number | null;
}

// Streams an internal agent's response over SSE, yielding each AgentRunEvent as it
// arrives. Sends the session cookie like every other call. Throws ApiError when the
// request itself fails before the stream starts (e.g. 403/404); a failure during
// the run arrives as an `error` event, not a throw.
export async function* streamAiAgentRun(
  projectKey: string,
  agentId: number,
  input: { prompt: string; threadId?: string | null },
): AsyncGenerator<AgentRunEvent> {
  const body = input.threadId
    ? { prompt: input.prompt, threadId: input.threadId }
    : { prompt: input.prompt };
  const res = await fetch(`${API_URL}/projects/${projectKey}/ai-agents/${agentId}/run/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    throw new ApiError(res.status, err?.error ?? `${res.status} ${res.statusText}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    // SSE frames are separated by a blank line; each frame here is a single
    // `data:` line carrying one JSON-encoded event.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (line) yield JSON.parse(line.slice(5).trim()) as AgentRunEvent;
    }
  }
}

export type CustomFieldType =
  'text' | 'markdown' | 'url' | 'number' | 'boolean' | 'date' | 'select' | 'multi_select';

export interface CustomFieldOption {
  id: number;
  value: string;
  color: string;
  position: number;
}

export interface CustomField {
  id: number;
  issueTypeId: number | null;
  name: string;
  fieldType: CustomFieldType;
  // When true the field renders in the issue body (under the description);
  // when false it renders as a Properties row.
  showInBody: boolean;
  position: number;
  options: CustomFieldOption[];
}

// One custom field value on a project issue: the scalar value (null for
// select/multi_select and unset fields) and the selected option ids. Only
// fields with a value set appear; unset fields are omitted (see listIssues).
export interface IssueFieldValueEntry {
  fieldId: number;
  value: string | number | boolean | null;
  optionIds: number[];
}

export interface Issue {
  id: number;
  projectId: number;
  // Project-scoped sequence number (the "42" in "MKT-42"). Addresses the issue by
  // its human number in URLs (/project/MKT/issue/42).
  sequenceNumber: number;
  identifier: string;
  typeId: number | null;
  // The initiative this issue is linked to, expanded to id + title for rendering,
  // or null. Set through updateIssue by initiativeId.
  initiative: InitiativeOption | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  columnId: number;
  title: string;
  description: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  // When the issue was archived (hidden from the board but kept), or null when it
  // is active. Set by the archive action or the worker's auto-archive sweep.
  archivedAt: string | null;
  // When the issue entered its current column (or createdAt if it never moved).
  // Drives the "time in current status" badge.
  statusSince: string;
  labelIds: number[];
  fieldValues: IssueFieldValueEntry[];
}

// A light search result from GET /projects/:key/issues/search: enough to list and
// open a match, without the full issue's description or field values.
export interface IssueSearchHit {
  id: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  columnId: number;
  typeId: number | null;
  initiativeId: number | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  priority: string | null;
  dueDate: string | null;
  labelIds: number[];
  archived: boolean;
}

// Per-project auto-archive thresholds: days an issue may sit inactive in a
// completed/canceled column before the worker archives it. null disables archiving
// for that state group. Both null by default (nothing is archived until enabled).
export interface AutoArchiveSettings {
  completedDays: number | null;
  canceledDays: number | null;
}

// A project's settings: MCP reachability and the auto-archive thresholds.
export interface ProjectSettings {
  mcpEnabled: boolean;
  autoArchive: AutoArchiveSettings;
}

// Per-project notification provider credentials (owner-managed) plus a member's own
// delivery preferences. The issue events match the inbox notification types.
export type NotificationEncryption = 'none' | 'ssl' | 'tls';

export interface NotificationEventToggles {
  assigned: boolean;
  mentioned: boolean;
  commented: boolean;
  state_changed: boolean;
}

// The provider credentials as read from the API: secrets are never returned, only a
// `hasX` flag telling whether a value is stored.
export interface NotificationSettings {
  // Deliver email through the instance provider instead of the project's own. Its
  // credentials belong to the instance, so the project only turns it on.
  system: { enabled: boolean };
  // Whether the instance provider exists and is shared with projects right now.
  systemAvailable: boolean;
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
  telegram: { enabled: boolean; hasBotToken: boolean };
}

// A partial write. Each section is optional so a provider card saves on its own.
// A secret field left out or empty keeps its stored value.
export interface NotificationSettingsPatch {
  system?: { enabled: boolean };
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
  telegram?: { enabled: boolean; botToken?: string };
}

// ── Storage limits ────────────────────────────────────────────────────────────

// The instance upload limits. Readable by any signed-in user, because the upload UI
// states them before a file is picked; only god mode can change them.
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

// ── Instance administration (god mode) ────────────────────────────────────────

// Who may create an account on this instance.
export type RegistrationMode = 'open' | 'invite' | 'closed';

// The instance sign-in policy. hasEmailProvider tells whether outbound mail works;
// the options that depend on it cannot be turned on without one.
export interface InstanceAuthSettings {
  registration: RegistrationMode;
  requireEmailVerification: boolean;
  magicLink: boolean;
  hasEmailProvider: boolean;
}

export interface InstanceAuthSettingsPatch {
  registration?: RegistrationMode;
  requireEmailVerification?: boolean;
  magicLink?: boolean;
}

// The instance mail provider used for authentication email (password reset, address
// verification, magic links). Separate from a project's notification provider.
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

// One page of the directory. `total` counts every account matching the filters, so
// the pager can show the range and know whether there is a next page.
export interface InstanceUserPage {
  items: InstanceUser[];
  total: number;
}

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
  integrationCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}

// One member of a project, with the permissions their membership resolves to (full
// for an owner, the assigned role's matrix for a member).
export interface InstanceProjectMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isAgent: boolean;
  role: MemberRole;
  roleId: number | null;
  roleName: string | null;
  permissions: Permissions;
  joinedAt: string;
}

export interface InstanceProjectDetail extends InstanceProject {
  members: InstanceProjectMember[];
}

export interface InstanceProjectPage {
  items: InstanceProject[];
  total: number;
}

// What the sign-in and sign-up screens read before there is a session. magicLink,
// requireEmailVerification and google are already resolved against their provider by
// the API, so a screen can trust them without checking the credentials itself.
export interface PublicAuthConfig {
  registration: RegistrationMode;
  magicLink: boolean;
  requireEmailVerification: boolean;
  emailEnabled: boolean;
  google: boolean;
}

// The session member's own notification preferences for a project: which issue
// events they want by email and/or Telegram. Email is sent to the member's account
// address, Telegram to the account they linked in their profile.
export interface NotificationPreferences {
  emailEvents: NotificationEventToggles;
  telegramEvents: NotificationEventToggles;
}

// The session user's Telegram link. `botUsername` is null when no instance bot is
// configured, which is when Telegram is not offered at all; `link` is null while the
// user has not connected an account.
export interface TelegramAccount {
  botUsername: string | null;
  link: { username: string | null; firstName: string | null; linkedAt: string } | null;
}

// The deep link that completes a Telegram connection, and when its code expires.
export interface TelegramLinkStart {
  url: string;
  expiresAt: string;
}

// The signed-in user's interface preferences, held per account so they apply on
// every device. timezone is an IANA zone name the app renders stored UTC timestamps
// in; issueOpenMode decides whether a clicked issue opens in the side panel or on
// its own page; startPage is the section the app root lands on; showChatByDefault
// keeps the floating AI chat button on screen from the start; lastProjectId is the
// project the app root reopens (null until the user has opened one).
export type ThemePreference = 'light' | 'dark' | 'system';
export type IssueOpenMode = 'panel' | 'page';
export type StartPage = 'inbox' | 'dashboard' | 'work-items' | 'initiatives' | 'ai-chat';

export interface AccountPreferences {
  timezone: string;
  theme: ThemePreference;
  issueOpenMode: IssueOpenMode;
  startPage: StartPage;
  showChatByDefault: boolean;
  lastProjectId: number | null;
  // The keyboard shortcuts this user rebound, as { commandId: combo }. Only the
  // changed ones; the rest come from the instance settings, then the built-in
  // bindings (see lib/hotkeys).
  hotkeys: HotkeyOverrides;
}

// Rebound keyboard shortcuts: the combination each overridden command id takes. A
// command left out keeps the binding from the layer below.
export type HotkeyOverrides = Record<string, string>;

export type AccountPreferencesPatch = Partial<AccountPreferences>;

// A saved view (a tab above the work items view): a named filter set plus a display
// snapshot (layout + that layout's settings). Shared across clients — there is
// no per-user identity. filters/display are stored as jsonb.
export interface View {
  id: number;
  projectId: number;
  name: string;
  icon: string | null;
  filters: FilterSet;
  display: SavedViewDisplay;
  position: number;
  createdAt: string;
}

export interface NewViewInput {
  name: string;
  icon?: string | null;
  filters?: FilterSet;
  display?: SavedViewDisplay;
}

export interface ViewPatch {
  name?: string;
  icon?: string | null;
  filters?: FilterSet;
  display?: SavedViewDisplay;
}

// A saved dashboard: the analytics counterpart of a View. `layout` is the ordered
// list of widgets (owned by the UI, stored verbatim server-side as jsonb).
export interface Dashboard {
  id: number;
  projectId: number;
  name: string;
  icon: string | null;
  layout: DashboardLayout;
  position: number;
  createdAt: string;
}

export interface NewDashboardInput {
  name: string;
  icon?: string | null;
  layout?: DashboardLayout;
}

export interface DashboardPatch {
  name?: string;
  icon?: string | null;
  layout?: DashboardLayout;
}

// --- Analytics DTOs (project metrics behind the dashboard widgets) ---------------

export interface AnalyticsStats {
  open: number;
  inProgress: number;
  backlog: number;
  overdue: number;
  unassigned: number;
  closedLast7d: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  color: string | null;
}

export type PulseUnit = 'hour' | 'day' | 'week';

// One heatmap cell from the server: a preformatted bucket label (for the hover
// tooltip) and its activity count. The series is ordered oldest to newest.
export interface PulseBucket {
  label: string;
  count: number;
}

export interface ThroughputWeek {
  week: string;
  created: number;
  closed: number;
}

// One agent run in the project-wide feed (agent runs widget).
export interface AgentRunFeedItem {
  id: number;
  status: 'pending' | 'success' | 'failed';
  trigger: 'mention' | 'delegation' | 'schedule' | 'manual';
  agentId: number;
  agentName: string;
  issueId: number | null;
  issueSequence: number | null;
  lastError: string | null;
  createdAt: string;
}

// Agent run outcome counts over a window (agent health widget).
export interface AgentRunStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

// Webhook delivery health over a window plus the subscription split (webhook health widget).
export interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  activeWebhooks: number;
  disabledWebhooks: number;
}

// One agent's workload row: delegated open issues and lifetime run outcomes.
export interface AgentWorkloadItem {
  agentId: number;
  agentName: string;
  kind: string;
  delegatedOpen: number;
  runsTotal: number;
  runsSuccess: number;
  runsFailed: number;
}

export interface ActivityItem {
  id: number;
  issueId: number;
  issueSequence: number;
  issueTitle: string;
  kind: 'comment' | 'activity';
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: ActivityAction | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: FeedCursor | null;
}

// A manual action: a saved macro on a project. `condition` is a FilterSet (empty
// = always available) that decides which issues the action shows on; `effect`
// is a partial issue patch over built-in fields applied in one update when the
// action runs. A present effect key sets that field (value may be null); an
// absent key leaves it unchanged.
export type ActionEffect = Pick<
  IssuePatch,
  'columnId' | 'assigneeUserId' | 'priority' | 'typeId' | 'startDate' | 'dueDate' | 'labelIds'
>;

export interface ActionDef {
  id: number;
  projectId: number;
  name: string;
  icon: string;
  condition: FilterSet;
  effect: ActionEffect;
  position: number;
  createdAt: string;
}

export interface NewActionInput {
  name: string;
  icon?: string;
  condition?: FilterSet;
  effect?: ActionEffect;
}

export interface ActionPatch {
  name?: string;
  icon?: string;
  condition?: FilterSet;
  effect?: ActionEffect;
}

// Outgoing webhook subscription (mirrors apps/api webhooks/store.ts). The event
// types must stay in sync with WEBHOOK_EVENT_TYPES on the server.
export type WebhookEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.assigned'
  | 'issue.state_changed'
  | 'issue.label_changed'
  | 'comment.created';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.assigned',
  'issue.state_changed',
  'issue.label_changed',
  'comment.created',
];

export interface Webhook {
  id: number;
  projectId: number;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
}

export interface NewWebhookInput {
  url: string;
  events: WebhookEventType[];
  isActive?: boolean;
}

export interface WebhookPatch {
  url?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
}

// A recorded delivery attempt for the history view. payload is the request body we
// sent; responseStatus/responseBody come from the last attempt; lastError is set
// on a failed or retrying delivery.
export interface WebhookDelivery {
  id: number;
  eventId: string;
  eventType: WebhookEventType;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  payload: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
}

export interface WebhookDeliveryPage {
  items: WebhookDelivery[];
  nextCursor: number | null;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  // Absolute, no-auth URL — usable directly in <img>/<video> and in markdown.
  url: string;
}

// `action` selects how the UI renders an activity row; from_text/to_text are
// display-ready value snapshots (column/label/type/assignee name, raw priority,
// ISO date, or the new text of a long field). `subject` names the changed
// sub-item where the action alone is not enough (the custom field name for 'field').
export type ActivityAction =
  | 'created'
  | 'title'
  | 'description'
  | 'status'
  | 'assignee'
  | 'delegate'
  | 'priority'
  | 'type'
  | 'start_date'
  | 'due_date'
  | 'label_add'
  | 'label_remove'
  | 'field'
  | 'archived'
  | 'restored';

// One entry in an issue's timeline. kind selects which payload fields are set:
// a 'comment' carries body; an 'activity' carries action/subject/fromText/toText.
// actorName is the author/actor snapshot (null when it was never set).
export interface FeedItem {
  id: number;
  issueId: number;
  kind: 'comment' | 'activity';
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: ActivityAction | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: string;
}

// Opaque keyset cursor returned by the feed endpoint; pass it back to load the
// next (older) page.
export interface FeedCursor {
  ts: string;
  id: number;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
}

export interface IssueFieldValue {
  fieldId: number;
  name: string;
  fieldType: CustomFieldType;
  value: string | number | boolean | null;
  optionIds: number[];
}

// A custom field value on the way in (setFieldValue). `value` carries the
// scalar types, `optionIds` the select/multi_select ones; a field uses one or
// the other.
export interface IssueFieldValueInput {
  value?: string | number | boolean | null;
  optionIds?: number[];
}

// The caller's own role in a project (owner/member). Returned with the project;
// the resolved permission matrix is a sibling `permissions` field. See
// usePermissions.
export interface ProjectViewer {
  role: MemberRole;
}

export interface InitiativeOption {
  id: number;
  title: string;
}

// The board scaffold, returned by getProject: everything the work-items UI needs
// except the issues themselves (those come from getBoardIssues).
export interface ProjectScaffold {
  project: Project;
  columns: Column[];
  issueTypes: IssueType[];
  labels: Label[];
  labelGroups: LabelGroup[];
  assignees: Assignee[];
  // Every custom field of the project (all type scopes); consumers filter by
  // issueTypeId locally.
  customFields: CustomField[];
  viewer: ProjectViewer;
  // The caller's resolved permission matrix (owners get every flag).
  permissions: Permissions;
}

// The board's issues plus its change marker, returned by getBoardIssues. Polled
// for live refresh (rev matches getBoardIssuesRev).
export interface BoardIssues {
  issues: Issue[];
  rev: string;
}

// The scaffold composed with its issues, as the Shell assembles it and passes it
// down. Downstream reads project.issues / project.rev off this composite.
export type ProjectDetail = ProjectScaffold & BoardIssues;

export interface IssueDetail extends Issue {
  fields: IssueFieldValue[];
}

export interface NewIssueInput {
  typeId?: number | null;
  initiativeId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  columnId: number;
  title: string;
  description?: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  labelIds?: number[];
}

// The fields a bulk update can set on many issues at once (the board-relevant
// subset of IssuePatch: no title/description/position).
export interface BulkIssuePatch {
  columnId?: number;
  typeId?: number | null;
  initiativeId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface IssuePatch {
  columnId?: number;
  position?: number;
  typeId?: number | null;
  initiativeId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  title?: string;
  description?: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  labelIds?: number[];
}

// --- Initiatives -----------------------------------------------------------------
// A project-scoped grouping of issues. progress and health are derived server-side
// from the linked issues' states (health is null when there is nothing to judge).

export type InitiativeStatus = 'proposed' | 'planned' | 'active' | 'completed' | 'canceled';
export type InitiativeHealth = 'on_track' | 'at_risk' | 'off_track';

export interface InitiativeProgress {
  completed: number;
  canceled: number;
  total: number;
}

export interface Initiative {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: InitiativeStatus;
  ownerUserId: string | null;
  priority: string | null;
  startDate: string | null;
  targetDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  labelIds: number[];
  progress: InitiativeProgress;
  health: InitiativeHealth | null;
}

export interface NewInitiativeInput {
  title: string;
  description?: string;
  status?: InitiativeStatus;
  ownerUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  labelIds?: number[];
}

export interface InitiativePatch {
  title?: string;
  description?: string;
  status?: InitiativeStatus;
  ownerUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  labelIds?: number[];
}

// One entry in an initiative's feed: an event of the initiative itself (source
// 'initiative') or the activity of a linked issue (source 'issue', carrying the
// issue's id and identifier so the row can link to it).
export interface InitiativeFeedItem {
  id: number;
  source: 'initiative' | 'issue';
  kind: 'comment' | 'activity';
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: string;
  issueId: number | null;
  issueIdentifier: string | null;
}

export interface InitiativeFeedPage {
  items: InitiativeFeedItem[];
  nextCursor: FeedCursor | null;
}

export interface NewCustomFieldInput {
  issueTypeId?: number | null;
  name: string;
  fieldType: CustomFieldType;
  showInBody?: boolean;
  options?: string[];
}

// The project permission matrix (mirrors apps/api shared/permissions.ts): 13
// resources, each granting or denying 4 actions. A custom role carries one matrix.
export type PermissionAction = 'create' | 'edit' | 'read' | 'delete';

export type PermissionResource =
  | 'work_items'
  | 'initiatives'
  | 'dashboards'
  | 'views'
  | 'members_invite'
  | 'members_manage'
  | 'states'
  | 'issue_types'
  | 'labels'
  | 'ai_agents'
  | 'integrations'
  | 'agent_skills'
  | 'agent_tools'
  | 'custom_fields'
  | 'actions'
  | 'webhooks'
  | 'danger_zone';

export type ResourcePermissions = Record<PermissionAction, boolean>;
export type Permissions = Record<PermissionResource, ResourcePermissions>;

// A project's custom role: a named permission matrix that can be assigned to a
// member. `isDefault` marks the fallback role new members get; it cannot be deleted.
export interface Role {
  id: number;
  name: string;
  isDefault: boolean;
  permissions: Permissions;
  createdAt: string;
}

// The resources and actions the role editor renders. Fetched so the UI matches the
// API's matrix without hardcoding the list in two places.
export interface PermissionCatalog {
  resources: PermissionResource[];
  actions: PermissionAction[];
}

// Project membership: a user's access to a project and their role in it. New
// members join through invites, not a direct add.
export type MemberRole = 'owner' | 'member';

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: MemberRole;
  // The assigned custom role. null when the member uses the project's default
  // role; owners never use roles (both fields null).
  roleId: number | null;
  roleName: string | null;
  // What this member does in the project, set by an owner. Empty string when unset.
  description: string;
  // True when this member is an AI agent's bot user. Its role and access are managed
  // on the AI Agents screen, so this list does not let you reassign or revoke it.
  isAgent: boolean;
  createdAt: string;
}

export type InviteStatus = 'pending' | 'accepted' | 'rejected';

// An invite as shown to the owner managing a project's invites: carries the token
// so the owner can share the link, and who sent it.
export interface InviteRow {
  id: number;
  token: string;
  email: string;
  role: MemberRole;
  // The custom role the invitee joins on (for a member invite). null falls back
  // to the default role; roleName resolves it for display. An owner invite has
  // both null.
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  respondedAt: string | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

// An invite as shown to the invitee opening the link: enough project context to
// decide, never the internal project id.
export interface InviteView {
  token: string;
  projectKey: string;
  projectName: string;
  email: string;
  role: MemberRole;
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  // Whether the invited email already has an account, so the accept screen can
  // open in sign-in mode instead of registration.
  hasAccount: boolean;
}

// The attachment DTO's url is relative to the API origin; make it absolute so it
// works in <img>/<video> and markdown rendered on the web origin.
function absolutizeAttachment(a: Attachment): Attachment {
  return { ...a, url: a.url.startsWith('http') ? a.url : `${API_URL}${a.url}` };
}

// Inbox notifications. Each row is enriched with the issue and project it points at
// so the list renders without extra calls.
export type NotificationType = 'assigned' | 'mentioned' | 'commented' | 'state_changed';

export interface Notification {
  id: number;
  type: NotificationType;
  actorUserId: string | null;
  actorName: string | null;
  readAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  issueId: number;
  issueSeq: number;
  issueTitle: string;
  issueStateType: StateType;
  projectId: number;
  projectKey: string;
  projectName: string;
}

export interface NotificationCursor {
  ts: string;
  id: number;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: NotificationCursor | null;
}

export interface NotificationFilters {
  types?: NotificationType[];
  from?: string;
  includeRead?: boolean;
  includeSnoozed?: boolean;
}

export type NotificationDeleteScope = 'all' | 'read' | 'read-completed';

export const api = {
  listProjects: (opts?: { permissions?: boolean }) =>
    request<Project[]>(`/projects${opts?.permissions ? '?permissions=true' : ''}`),
  createProject: (input: { key: string; name: string; description?: string; preset?: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  copyProject: (
    projectKey: string,
    input: {
      key: string;
      name: string;
      description?: string;
      include?: Partial<Record<CopyProjectIncludeKey, boolean>>;
    },
  ) =>
    request<Project>(`/projects/${projectKey}/copy`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // Update a project's name/description. The key is immutable, so it is not sent.
  updateProject: (projectKey: string, patch: { name?: string; description?: string }) =>
    request<Project>(`/projects/${projectKey}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (projectKey: string) =>
    request<void>(`/projects/${projectKey}`, { method: 'DELETE' }),
  // The board scaffold (no issues). The issues come from getBoardIssues.
  getProject: (projectKey: string) => request<ProjectScaffold>(`/projects/${projectKey}`),
  // The board's issues plus its change marker.
  getBoardIssues: (projectKey: string) =>
    request<BoardIssues>(`/projects/${projectKey}/issues/board`),
  // Cheap change marker for the board issues — polled for live refresh, refetch
  // getBoardIssues only when rev changes.
  getBoardIssuesRev: (projectKey: string) =>
    request<{ rev: string }>(`/projects/${projectKey}/issues/rev`),

  createColumn: (
    projectKey: string,
    input: { name: string; stateType: StateType; color?: string },
  ) =>
    request<Column>(`/projects/${projectKey}/columns`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateColumn: (
    projectKey: string,
    columnId: number,
    patch: { name?: string; stateType?: StateType; color?: string },
  ) =>
    request<Column>(`/projects/${projectKey}/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  reorderColumns: (projectKey: string, orderedIds: number[]) =>
    request<Column[]>(`/projects/${projectKey}/columns/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),
  deleteColumn: (
    projectKey: string,
    columnId: number,
    body: { mode: 'move'; targetColumnId: number } | { mode: 'delete' },
  ) =>
    request<void>(`/projects/${projectKey}/columns/${columnId}`, {
      method: 'DELETE',
      body: JSON.stringify(body),
    }),

  createIssueType: (
    projectKey: string,
    input: { name: string; icon?: string; color?: string; isDefault?: boolean },
  ) =>
    request<IssueType>(`/projects/${projectKey}/issue-types`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateIssueType: (
    projectKey: string,
    typeId: number,
    patch: { name?: string; color?: string; isDefault?: boolean },
  ) =>
    request<IssueType>(`/projects/${projectKey}/issue-types/${typeId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteIssueType: (projectKey: string, typeId: number) =>
    request<void>(`/projects/${projectKey}/issue-types/${typeId}`, { method: 'DELETE' }),

  createLabel: (
    projectKey: string,
    input: { name: string; color?: string; groupId?: number | null },
  ) =>
    request<Label>(`/projects/${projectKey}/labels`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLabel: (
    projectKey: string,
    labelId: number,
    patch: { name?: string; color?: string; groupId?: number | null },
  ) =>
    request<Label>(`/projects/${projectKey}/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteLabel: (projectKey: string, labelId: number) =>
    request<void>(`/projects/${projectKey}/labels/${labelId}`, { method: 'DELETE' }),

  createLabelGroup: (projectKey: string, input: { name: string; color?: string }) =>
    request<LabelGroup>(`/projects/${projectKey}/label-groups`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLabelGroup: (
    projectKey: string,
    groupId: number,
    patch: { name?: string; color?: string },
  ) =>
    request<LabelGroup>(`/projects/${projectKey}/label-groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteLabelGroup: (projectKey: string, groupId: number) =>
    request<void>(`/projects/${projectKey}/label-groups/${groupId}`, { method: 'DELETE' }),

  listCustomFields: (projectKey: string, issueTypeId?: number) =>
    request<CustomField[]>(
      `/projects/${projectKey}/custom-fields${issueTypeId != null ? `?issueTypeId=${issueTypeId}` : ''}`,
    ),
  createCustomField: (projectKey: string, input: NewCustomFieldInput) =>
    request<CustomField>(`/projects/${projectKey}/custom-fields`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCustomField: (
    projectKey: string,
    fieldId: number,
    patch: { name?: string; showInBody?: boolean },
  ) =>
    request<CustomField>(`/projects/${projectKey}/custom-fields/${fieldId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteCustomField: (projectKey: string, fieldId: number) =>
    request<void>(`/projects/${projectKey}/custom-fields/${fieldId}`, { method: 'DELETE' }),

  createIssue: (projectKey: string, input: NewIssueInput) =>
    request<Issue>(`/projects/${projectKey}/issues`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getIssue: (id: number) => request<IssueDetail>(`/issues/${id}`),
  // Resolve an issue by its project-scoped number (the human "42" in the URL).
  getIssueBySeq: (projectKey: string, seq: number) =>
    request<IssueDetail>(`/projects/${projectKey}/issues/${seq}`),
  // Cheap change marker for an issue's detail + feed — polled for live refresh.
  getIssueRev: (id: number) => request<{ rev: string }>(`/issues/${id}/rev`),
  updateIssue: (id: number, patch: IssuePatch) =>
    request<Issue>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteIssue: (id: number) => request<void>(`/issues/${id}`, { method: 'DELETE' }),
  // Board multi-select: apply one change to many issues in a single request. The
  // server filters the ids to the project and refetching happens once.
  bulkUpdateIssues: (projectKey: string, ids: number[], patch: BulkIssuePatch) =>
    request<{ updated: number }>(`/projects/${projectKey}/issues/bulk`, {
      method: 'PATCH',
      body: JSON.stringify({ ids, patch }),
    }),
  bulkAddLabels: (projectKey: string, ids: number[], add: number[]) =>
    request<{ updated: number }>(`/projects/${projectKey}/issues/bulk/labels`, {
      method: 'POST',
      body: JSON.stringify({ ids, add }),
    }),
  bulkArchiveIssues: (projectKey: string, ids: number[]) =>
    request<{ archived: number }>(`/projects/${projectKey}/issues/bulk/archive`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  bulkDeleteIssues: (projectKey: string, ids: number[]) =>
    request<{ deleted: number }>(`/projects/${projectKey}/issues/bulk/delete`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  // Archive/restore: hide an issue from the board (kept, restorable) or bring it
  // back. The board excludes archived issues; the archive settings section lists them.
  archiveIssue: (id: number) => request<Issue>(`/issues/${id}/archive`, { method: 'POST' }),
  restoreIssue: (id: number) => request<Issue>(`/issues/${id}/restore`, { method: 'POST' }),
  listArchivedIssues: (projectKey: string) =>
    request<Issue[]>(`/projects/${projectKey}/issues/archived`),
  // Server-side text search for the command palette. Always returns all matches,
  // archived included (each hit carries an `archived` flag).
  searchIssues: (projectKey: string, params: { q?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.limit != null) qs.set('limit', String(params.limit));
    return request<IssueSearchHit[]>(`/projects/${projectKey}/issues/search?${qs.toString()}`);
  },
  setFieldValue: (issueId: number, fieldId: number, input: IssueFieldValueInput) =>
    request<{ ok: boolean }>(`/issues/${issueId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  listAttachments: (issueId: number) =>
    request<Attachment[]>(`/issues/${issueId}/attachments`).then((rows) =>
      rows.map(absolutizeAttachment),
    ),
  // Multipart upload — cannot use request(), which forces a JSON Content-Type;
  // the browser must set the multipart boundary itself, so no headers are set.
  uploadAttachment: async (issueId: number, file: File): Promise<Attachment> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/issues/${issueId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
    }
    return absolutizeAttachment(await res.json());
  },
  deleteAttachment: (publicId: string) =>
    request<void>(`/attachments/${publicId}`, { method: 'DELETE' }),

  listFeed: (issueId: number, params: { cursor?: FeedCursor | null; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
    const qs = q.toString();
    return request<FeedPage>(`/issues/${issueId}/feed${qs ? `?${qs}` : ''}`);
  },
  createComment: (issueId: number, input: { body: string }) =>
    request<FeedItem>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Initiatives — collection ops take projectKey; ops on one initiative take its
  // own id and hit /initiatives/:id (like issues).
  listInitiatives: (projectKey: string, statuses?: string[]) => {
    const q =
      statuses && statuses.length ? `?status=${encodeURIComponent(statuses.join(','))}` : '';
    return request<Initiative[]>(`/projects/${projectKey}/initiatives${q}`);
  },
  getInitiative: (id: number) => request<Initiative>(`/initiatives/${id}`),
  createInitiative: (projectKey: string, input: NewInitiativeInput) =>
    request<Initiative>(`/projects/${projectKey}/initiatives`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateInitiative: (id: number, patch: InitiativePatch) =>
    request<Initiative>(`/initiatives/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteInitiative: (id: number) => request<void>(`/initiatives/${id}`, { method: 'DELETE' }),
  // Cheap change marker for an initiative's detail + feed — polled for live refresh.
  getInitiativeRev: (id: number) => request<{ rev: string }>(`/initiatives/${id}/rev`),
  listInitiativeFeed: (id: number, params: { cursor?: FeedCursor | null; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
    const qs = q.toString();
    return request<InitiativeFeedPage>(`/initiatives/${id}/feed${qs ? `?${qs}` : ''}`);
  },

  listViews: (projectKey: string) => request<View[]>(`/projects/${projectKey}/views`),
  createView: (projectKey: string, input: NewViewInput) =>
    request<View>(`/projects/${projectKey}/views`, { method: 'POST', body: JSON.stringify(input) }),
  updateView: (viewId: number, patch: ViewPatch) =>
    request<View>(`/views/${viewId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteView: (viewId: number) => request<void>(`/views/${viewId}`, { method: 'DELETE' }),
  reorderViews: (projectKey: string, orderedIds: number[]) =>
    request<View[]>(`/projects/${projectKey}/views/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  // Dashboards — same CRUD shape as views: collection ops take projectKey, ops on
  // a single dashboard take its own id and hit /dashboards/:id.
  listDashboards: (projectKey: string) =>
    request<Dashboard[]>(`/projects/${projectKey}/dashboards`),
  createDashboard: (projectKey: string, input: NewDashboardInput) =>
    request<Dashboard>(`/projects/${projectKey}/dashboards`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateDashboard: (dashboardId: number, patch: DashboardPatch) =>
    request<Dashboard>(`/dashboards/${dashboardId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteDashboard: (dashboardId: number) =>
    request<void>(`/dashboards/${dashboardId}`, { method: 'DELETE' }),
  reorderDashboards: (projectKey: string, orderedIds: number[]) =>
    request<Dashboard[]>(`/projects/${projectKey}/dashboards/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  // Analytics — read-only project metrics behind the dashboard widgets.
  getStats: (projectKey: string) =>
    request<AnalyticsStats>(`/projects/${projectKey}/analytics/stats`),
  getBreakdown: (projectKey: string, by: BreakdownBy) =>
    request<BreakdownItem[]>(`/projects/${projectKey}/analytics/breakdown?by=${by}`),
  getPulse: (projectKey: string, unit: PulseUnit, columns: number) =>
    request<PulseBucket[]>(
      `/projects/${projectKey}/analytics/pulse?unit=${unit}&columns=${columns}`,
    ),
  getThroughput: (projectKey: string, weeks = 12) =>
    request<ThroughputWeek[]>(`/projects/${projectKey}/analytics/throughput?weeks=${weeks}`),
  listActivity: (
    projectKey: string,
    params: {
      cursor?: FeedCursor | null;
      limit?: number;
      actorUserId?: string | null;
      action?: string | null;
      issueIds?: number[] | null;
    } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
    if (params.actorUserId != null) q.set('actorUserId', params.actorUserId);
    if (params.action) q.set('action', params.action);
    if (params.issueIds) q.set('issueIds', params.issueIds.join(','));
    const qs = q.toString();
    return request<ActivityPage>(`/projects/${projectKey}/analytics/activity${qs ? `?${qs}` : ''}`);
  },
  getAgentRuns: (projectKey: string, params: { status?: string | null; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<AgentRunFeedItem[]>(
      `/projects/${projectKey}/analytics/agent-runs${qs ? `?${qs}` : ''}`,
    );
  },
  getAgentRunStats: (projectKey: string, days = 30) =>
    request<AgentRunStats>(`/projects/${projectKey}/analytics/agent-run-stats?days=${days}`),
  getWebhookStats: (projectKey: string, days = 30) =>
    request<WebhookStats>(`/projects/${projectKey}/analytics/webhook-stats?days=${days}`),
  getAgentWorkload: (projectKey: string) =>
    request<AgentWorkloadItem[]>(`/projects/${projectKey}/analytics/agent-workload`),

  // Members: list who is on a project, and revoke access (an owner removes
  // anyone; a member removes only themselves — leaving the project).
  listMembers: (projectKey: string) => request<MemberRow[]>(`/projects/${projectKey}/members`),
  removeMember: (projectKey: string, userId: string) =>
    request<void>(`/projects/${projectKey}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
  // Set a member's role (owner-only). role 'owner' promotes to owner; role
  // 'member' assigns a custom role via roleId (null resets to the default role).
  // The last owner cannot be demoted — the API rejects it.
  setMemberRole: (
    projectKey: string,
    userId: string,
    input: { role: MemberRole; roleId?: number | null },
  ) =>
    request<void>(`/projects/${projectKey}/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  // Set what a member does in the project (owner-only). Empty string clears it.
  setMemberDescription: (projectKey: string, userId: string, description: string) =>
    request<void>(`/projects/${projectKey}/members/${encodeURIComponent(userId)}/description`, {
      method: 'PATCH',
      body: JSON.stringify({ description }),
    }),

  // AI agents: a project's bot users and their configuration. The plaintext key
  // is returned only by create and regenerate-key, so those responses carry it
  // alongside the agent; it is never part of a list/read.
  listAiAgents: (projectKey: string) => request<AiAgent[]>(`/projects/${projectKey}/ai-agents`),
  listAgentTools: (projectKey: string) =>
    request<AgentTool[]>(`/projects/${projectKey}/ai-agents/tools`),
  createAiAgent: (projectKey: string, input: NewAiAgentInput) =>
    request<{ agent: AiAgent; apiKey: string | null }>(`/projects/${projectKey}/ai-agents`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateAiAgent: (projectKey: string, agentId: number, patch: AiAgentPatch) =>
    request<AiAgent>(`/projects/${projectKey}/ai-agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  regenerateAiAgentKey: (projectKey: string, agentId: number) =>
    request<{ apiKey: string }>(`/projects/${projectKey}/ai-agents/${agentId}/regenerate-key`, {
      method: 'POST',
    }),
  deleteAiAgent: (projectKey: string, agentId: number) =>
    request<void>(`/projects/${projectKey}/ai-agents/${agentId}`, { method: 'DELETE' }),
  listAgentRuns: (projectKey: string, agentId: number, before?: number) =>
    request<AgentRunPage>(
      `/projects/${projectKey}/ai-agents/${agentId}/runs?limit=25${before ? `&before=${before}` : ''}`,
    ),
  listAgentSchedules: (projectKey: string) =>
    request<AgentSchedule[]>(`/projects/${projectKey}/agent-schedules`),
  createAgentSchedule: (projectKey: string, input: AgentScheduleInput) =>
    request<AgentSchedule>(`/projects/${projectKey}/agent-schedules`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateAgentSchedule: (
    projectKey: string,
    scheduleId: number,
    patch: Partial<AgentScheduleInput>,
  ) =>
    request<AgentSchedule>(`/projects/${projectKey}/agent-schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteAgentSchedule: (projectKey: string, scheduleId: number) =>
    request<void>(`/projects/${projectKey}/agent-schedules/${scheduleId}`, { method: 'DELETE' }),
  runAgentSchedule: (projectKey: string, scheduleId: number) =>
    request<{ runId: number }>(`/projects/${projectKey}/agent-schedules/${scheduleId}/run`, {
      method: 'POST',
    }),
  listAgentScheduleRuns: (projectKey: string, scheduleId: number) =>
    request<AgentScheduleRun[]>(`/projects/${projectKey}/agent-schedules/${scheduleId}/runs`),
  // The caller's own chat threads with an agent, newest first.
  listAiAgentThreads: (projectKey: string, agentId: number) =>
    request<AiChatThread[]>(`/projects/${projectKey}/ai-agents/${agentId}/threads`),
  // The transcript of one chat thread, to restore the conversation.
  getAiAgentThreadMessages: (projectKey: string, agentId: number, threadId: string, page: number) =>
    request<AiChatMessagePage>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}/messages?page=${page}`,
    ),

  // Integrations: stored credentials for LLM providers and tool integrations. The
  // secret is write-only — responses carry only a redacted view.
  listIntegrationCatalog: (projectKey: string) =>
    request<IntegrationMeta[]>(`/projects/${projectKey}/integrations/catalog`),
  listIntegrationModels: (projectKey: string, provider: string) =>
    request<ProviderModel[]>(
      `/projects/${projectKey}/integrations/models/${encodeURIComponent(provider)}`,
    ),
  listCredentials: (projectKey: string) =>
    request<IntegrationCredential[]>(`/projects/${projectKey}/integrations`),
  createCredential: (projectKey: string, input: NewCredentialInput) =>
    request<IntegrationCredential>(`/projects/${projectKey}/integrations`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCredential: (projectKey: string, credentialId: number, patch: CredentialPatch) =>
    request<IntegrationCredential>(`/projects/${projectKey}/integrations/${credentialId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteCredential: (projectKey: string, credentialId: number) =>
    request<void>(`/projects/${projectKey}/integrations/${credentialId}`, { method: 'DELETE' }),

  // Agent skills: the project skill library and the skills enabled on an agent.
  listSkills: (projectKey: string) => request<AgentSkill[]>(`/projects/${projectKey}/agent-skills`),
  getSkillMarkdown: (projectKey: string, skillId: number) =>
    request<{ markdown: string }>(`/projects/${projectKey}/agent-skills/${skillId}/markdown`),
  getSkillReferenceContent: (projectKey: string, skillId: number, path: string) =>
    request<{ content: string }>(
      `/projects/${projectKey}/agent-skills/${skillId}/references/content?path=${encodeURIComponent(path)}`,
    ),
  createSkill: (projectKey: string, input: NewSkillInput) =>
    request<AgentSkill>(`/projects/${projectKey}/agent-skills`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  discoverGithubSkills: (projectKey: string, url: string) =>
    request<GithubSkillCandidate[]>(`/projects/${projectKey}/agent-skills/github/discover`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  updateSkill: (projectKey: string, skillId: number, patch: SkillPatch) =>
    request<AgentSkill>(`/projects/${projectKey}/agent-skills/${skillId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteSkill: (projectKey: string, skillId: number) =>
    request<void>(`/projects/${projectKey}/agent-skills/${skillId}`, { method: 'DELETE' }),
  // Multipart upload for a skill reference — see uploadAttachment for why request()
  // cannot be used.
  addSkillReference: async (
    projectKey: string,
    skillId: number,
    file: File,
  ): Promise<AgentSkill> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(
      `${API_URL}/projects/${projectKey}/agent-skills/${skillId}/references`,
      {
        method: 'POST',
        credentials: 'include',
        body: form,
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`);
    }
    return res.json();
  },
  updateSkillReferenceContent: (
    projectKey: string,
    skillId: number,
    path: string,
    content: string,
  ) =>
    request<AgentSkill>(`/projects/${projectKey}/agent-skills/${skillId}/references/content`, {
      method: 'PATCH',
      body: JSON.stringify({ path, content }),
    }),
  deleteSkillReference: (projectKey: string, skillId: number, path: string) =>
    request<AgentSkill>(
      `/projects/${projectKey}/agent-skills/${skillId}/references?path=${encodeURIComponent(path)}`,
      { method: 'DELETE' },
    ),
  listAgentSkills: (projectKey: string, agentId: number) =>
    request<AgentSkill[]>(`/projects/${projectKey}/ai-agents/${agentId}/skills`),
  setAgentSkills: (projectKey: string, agentId: number, skillIds: number[]) =>
    request<AgentSkill[]>(`/projects/${projectKey}/ai-agents/${agentId}/skills`, {
      method: 'PUT',
      body: JSON.stringify({ skillIds }),
    }),

  // Configured tools: a project's tools bound to a credential, and the tools enabled
  // on one agent. The tool catalog itself comes from the integrations catalog.
  listConfiguredTools: (projectKey: string) =>
    request<ConfiguredTool[]>(`/projects/${projectKey}/agent-tools`),
  createConfiguredTool: (projectKey: string, input: NewConfiguredToolInput) =>
    request<ConfiguredTool>(`/projects/${projectKey}/agent-tools`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteConfiguredTool: (projectKey: string, agentToolId: number) =>
    request<void>(`/projects/${projectKey}/agent-tools/${agentToolId}`, { method: 'DELETE' }),
  listAgentToolLinks: (projectKey: string, agentId: number) =>
    request<ConfiguredTool[]>(`/projects/${projectKey}/ai-agents/${agentId}/tool-configs`),
  setAgentTools: (projectKey: string, agentId: number, agentToolIds: number[]) =>
    request<ConfiguredTool[]>(`/projects/${projectKey}/ai-agents/${agentId}/tool-configs`, {
      method: 'PUT',
      body: JSON.stringify({ agentToolIds }),
    }),

  // Roles: a project's custom roles and the permission catalog behind the role
  // editor. Any member can list; create/update/delete are owner-only on the API.
  getPermissionCatalog: () => request<PermissionCatalog>('/permission-catalog'),
  listRoles: (projectKey: string) => request<Role[]>(`/projects/${projectKey}/roles`),
  createRole: (projectKey: string, input: { name: string; permissions: Permissions }) =>
    request<Role>(`/projects/${projectKey}/roles`, { method: 'POST', body: JSON.stringify(input) }),
  updateRole: (
    projectKey: string,
    roleId: number,
    patch: { name?: string; permissions?: Permissions },
  ) =>
    request<Role>(`/projects/${projectKey}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteRole: (projectKey: string, roleId: number) =>
    request<void>(`/projects/${projectKey}/roles/${roleId}`, { method: 'DELETE' }),

  // Invites — owner side: create, list, and revoke a project's invite links.
  listInvites: (projectKey: string) => request<InviteRow[]>(`/projects/${projectKey}/invites`),
  createInvite: (
    projectKey: string,
    input: { email: string; role: MemberRole; roleId?: number | null },
  ) =>
    request<InviteRow>(`/projects/${projectKey}/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteInvite: (projectKey: string, inviteId: number) =>
    request<void>(`/projects/${projectKey}/invites/${inviteId}`, { method: 'DELETE' }),

  // Invites — invitee side: open a link by token, then accept or reject it. The
  // session email must match the invite. Accept returns where to go next.
  getInvite: (token: string) => request<InviteView>(`/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) =>
    request<{ projectKey: string; projectName: string; role: MemberRole }>(
      `/invites/${encodeURIComponent(token)}/accept`,
      { method: 'POST' },
    ),
  rejectInvite: (token: string) =>
    request<void>(`/invites/${encodeURIComponent(token)}/reject`, { method: 'POST' }),

  listActions: (projectKey: string) => request<ActionDef[]>(`/projects/${projectKey}/actions`),
  createAction: (projectKey: string, input: NewActionInput) =>
    request<ActionDef>(`/projects/${projectKey}/actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateAction: (actionId: number, patch: ActionPatch) =>
    request<ActionDef>(`/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAction: (actionId: number) => request<void>(`/actions/${actionId}`, { method: 'DELETE' }),
  reorderActions: (projectKey: string, orderedIds: number[]) =>
    request<ActionDef[]>(`/projects/${projectKey}/actions/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  listWebhooks: (projectKey: string) => request<Webhook[]>(`/projects/${projectKey}/webhooks`),
  createWebhook: (projectKey: string, input: NewWebhookInput) =>
    request<Webhook>(`/projects/${projectKey}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateWebhook: (webhookId: number, patch: WebhookPatch) =>
    request<Webhook>(`/webhooks/${webhookId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteWebhook: (webhookId: number) =>
    request<void>(`/webhooks/${webhookId}`, { method: 'DELETE' }),
  listWebhookDeliveries: (webhookId: number, before?: number) =>
    request<WebhookDeliveryPage>(
      `/webhooks/${webhookId}/deliveries?limit=25${before ? `&before=${before}` : ''}`,
    ),

  // Project settings: MCP reachability and auto-archive thresholds. Any member
  // reads; owner writes. The PATCH takes only the fields being changed.
  getProjectSettings: (projectKey: string) =>
    request<ProjectSettings>(`/projects/${projectKey}/settings`),
  updateProjectSettings: (
    projectKey: string,
    patch: { mcpEnabled?: boolean; autoArchive?: AutoArchiveSettings },
  ) =>
    request<ProjectSettings>(`/projects/${projectKey}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // Notification provider credentials (danger_zone: read to view, edit to change).
  getNotificationSettings: (projectKey: string) =>
    request<NotificationSettings>(`/projects/${projectKey}/notification-settings`),
  setNotificationSettings: (projectKey: string, input: NotificationSettingsPatch) =>
    request<NotificationSettings>(`/projects/${projectKey}/notification-settings`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  // The session member's own notification preferences for a project (any member).
  getNotificationPreferences: (projectKey: string) =>
    request<NotificationPreferences>(`/projects/${projectKey}/notification-preferences`),
  setNotificationPreferences: (projectKey: string, input: NotificationPreferences) =>
    request<NotificationPreferences>(`/projects/${projectKey}/notification-preferences`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  // The session user's own Telegram account link. Starting a link returns the bot
  // deep link that completes it; the bot service writes the connection when the user
  // opens it.
  getTelegramAccount: () => request<TelegramAccount>('/telegram/account'),
  startTelegramLink: () => request<TelegramLinkStart>('/telegram/account/link', { method: 'POST' }),
  unlinkTelegramAccount: () => request<void>('/telegram/account', { method: 'DELETE' }),

  // The session user's own interface preferences, held per account. A read returns
  // the defaults when nothing was saved; a write patches only the fields it carries.
  getAccountPreferences: () => request<AccountPreferences>('/account/preferences'),
  updateAccountPreferences: (input: AccountPreferencesPatch) =>
    request<AccountPreferences>('/account/preferences', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  // Inbox notifications. The list is the session user's own; projectId scopes it to
  // one project (the per-project inbox). cursor is the JSON-encoded keyset from the
  // previous page.
  listNotifications: (
    projectId: number,
    params: {
      cursor?: NotificationCursor | null;
      limit?: number;
      filters?: NotificationFilters;
    } = {},
  ) => {
    const q = new URLSearchParams();
    q.set('projectId', String(projectId));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
    const f = params.filters ?? {};
    if (f.types?.length) q.set('types', f.types.join(','));
    if (f.from) q.set('from', f.from);
    if (f.includeRead === false) q.set('includeRead', 'false');
    if (f.includeSnoozed) q.set('includeSnoozed', 'true');
    return request<NotificationPage>(`/notifications?${q.toString()}`);
  },
  // Change marker + unread count for one project's inbox, for live refresh and the
  // sidebar badge.
  getNotificationsRev: (projectId: number) =>
    request<{ rev: string; unread: number }>(`/notifications/rev?projectId=${projectId}`),
  setNotificationRead: (id: number, read: boolean) =>
    request<void>(`/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({ read }) }),
  snoozeNotification: (id: number, until: string | null) =>
    request<void>(`/notifications/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ until }),
    }),
  markAllNotificationsRead: (projectId: number) =>
    request<{ count: number }>(`/notifications/read-all`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  deleteNotification: (id: number) => request<void>(`/notifications/${id}`, { method: 'DELETE' }),
  deleteNotifications: (scope: NotificationDeleteScope, projectId: number) =>
    request<{ count: number }>(`/notifications?scope=${scope}&projectId=${projectId}`, {
      method: 'DELETE',
    }),

  // Instance administration (god mode). Every route below is owner-only; a plain
  // user gets a 403, which is why the entries are hidden from the sidebar.
  getInstanceAuthSettings: () => request<InstanceAuthSettings>('/god/auth-settings'),
  updateInstanceAuthSettings: (patch: InstanceAuthSettingsPatch) =>
    request<InstanceAuthSettings>('/god/auth-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  getInstanceEmailSettings: () => request<InstanceEmailSettings>('/god/email-settings'),
  updateInstanceEmailSettings: (patch: InstanceEmailSettingsPatch) =>
    request<InstanceEmailSettings>('/god/email-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  getInstanceTelegramSettings: () => request<InstanceTelegramSettings>('/god/telegram-settings'),
  updateInstanceTelegramSettings: (patch: InstanceTelegramSettingsPatch) =>
    request<InstanceTelegramSettings>('/god/telegram-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  // The upload limits. The read is open to any signed-in user (the upload UI shows
  // the limit); the write is god mode.
  getStorageSettings: () => request<StorageSettings>('/settings/storage'),

  // The instance keyboard shortcuts. The read is open to any signed-in user (every
  // client applies them); the write is god mode.
  getHotkeySettings: () => request<HotkeyOverrides>('/settings/hotkeys'),
  getInstanceHotkeySettings: () => request<HotkeyOverrides>('/god/hotkey-settings'),
  updateInstanceHotkeySettings: (combos: HotkeyOverrides) =>
    request<HotkeyOverrides>('/god/hotkey-settings', {
      method: 'PUT',
      body: JSON.stringify(combos),
    }),

  getInstanceStorageSettings: () => request<StorageSettings>('/god/storage-settings'),
  updateInstanceStorageSettings: (patch: StorageSettingsPatch) =>
    request<StorageSettings>('/god/storage-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  getInstanceGoogleSettings: () => request<InstanceGoogleSettings>('/god/google-settings'),
  updateInstanceGoogleSettings: (patch: InstanceGoogleSettingsPatch) =>
    request<InstanceGoogleSettings>('/god/google-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  // The instance user directory: one page of accounts, and one account with the
  // projects it can reach. Search, the kind filter and paging all run on the server.
  listInstanceUsers: (params: {
    search?: string;
    kind: InstanceUserKind;
    limit: number;
    offset: number;
  }) => {
    const query = new URLSearchParams({
      kind: params.kind,
      limit: String(params.limit),
      offset: String(params.offset),
    });
    if (params.search) query.set('search', params.search);
    return request<InstanceUserPage>(`/god/users?${query.toString()}`);
  },
  getInstanceUser: (userId: string) => request<InstanceUserDetail>(`/god/users/${userId}`),
  verifyInstanceUserEmail: (userId: string) =>
    request<InstanceUserDetail>(`/god/users/${userId}/verify-email`, { method: 'POST' }),
  // `withProjects` takes down the projects the user owns alone; without it the API
  // refuses to delete an account that would leave a project ownerless.
  deleteInstanceUser: (userId: string, withProjects: boolean) =>
    request<void>(`/god/users/${userId}${withProjects ? '?withProjects=true' : ''}`, {
      method: 'DELETE',
    }),
  // The instance project directory: one page of projects, and one project with its
  // members. Search and paging run on the server.
  listInstanceProjects: (params: { search?: string; limit: number; offset: number }) => {
    const query = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    });
    if (params.search) query.set('search', params.search);
    return request<InstanceProjectPage>(`/god/projects?${query.toString()}`);
  },
  getInstanceProject: (projectId: number) =>
    request<InstanceProjectDetail>(`/god/projects/${projectId}`),
  // The instance's own sign-in policy, readable without a session: the sign-up
  // screen needs it before an account exists.
  getAuthConfig: () => request<PublicAuthConfig>('/auth-config'),
};
