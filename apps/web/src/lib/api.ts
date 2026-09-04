// Typed client for the planner API (apps/api/src/planner). Row shapes mirror the
// store DTOs. The API is a separate service; the browser reaches it at the API
// origin below. The planner routes require a better-auth session, so every
// request sends credentials (the session cookie).

import type { Locale } from '@/i18n/locales';
import type { FilterSet } from '@/utils/filters';
import type { SavedViewDisplay } from '@/utils/viewSettings';
import type { DashboardLayout, BreakdownBy } from '@/utils/dashboardWidgets';
import { runtimeEnv } from '@/utils/runtimeEnv';

// The API origin, read from the running server rather than from the build (see
// utils/runtimeEnv). A deployment without it ships a client that cannot reach the
// API. Fail at import instead of pointing at a wrong origin.
export const API_URL = runtimeEnv().apiUrl;
if (!API_URL) throw new Error('API_URL is not set on the web service');

// Points a relative media path (a stored avatar or attachment URL) at the web
// origin's media route (app/media), which streams it from the API. Leaves an
// absolute URL — an embed stored before this, or an external image — untouched.
export function mediaUrl(url: string): string {
  return url.startsWith('http') ? url : `/media${url}`;
}

// An error carrying the HTTP status so callers can tell apart 401 (no session),
// 403 (no access to the project / not owner), 404 (not found) and 400 (a
// validation or business-rule failure). `message` is the API's `{ error }` text
// when present, so existing consumers that read `error.message` keep working.
// `code` names the failure where the API sends one, for a caller that has to
// branch on it rather than show the message.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Set while the session is being dropped, by the sign-out below or by the app's own
// `signOut`. Concurrent requests that all fail with 401 then trigger a single
// sign-out and a single navigation, and a sign-out the person asked for does not
// end on the expired screen.
let signingOut = false;

// Called by `signOut` in @/lib/auth-client before it drops the session: the requests
// that fail right after are the expected fallout, not a session the API refused.
export function markSigningOut(): void {
  signingOut = true;
}

// Called by SessionScope once a session appears without a page load, so a later 401
// is reacted to again. An accepted request does not prove one: /auth-config and the
// invite and share reads answer without a session.
export function markSignedIn(): void {
  signingOut = false;
}

// A 401 means the session behind the cookie is gone. The proxy only checks that a
// session cookie exists, so a stale one keeps the app open on a page where every
// request fails. Signing out is what drops the cookie; with it still set the proxy
// would bounce /login straight back into the app.
// The request is written out rather than calling `signOut()` from @/lib/auth-client:
// that module reads API_URL from this one, so importing it back here would make a
// cycle that evaluates auth-client before API_URL is assigned.
function endSession(): void {
  if (typeof window === 'undefined' || signingOut) return;
  signingOut = true;
  void fetch(`${API_URL}/api/auth/sign-out`, { method: 'POST', credentials: 'include' })
    .then((res) => {
      // Leaving with the cookie still set sends the proxy straight back into the
      // app, where the next 401 starts this over as a fresh page load.
      if (res.ok) window.location.replace('/login?expired=1');
      else signingOut = false;
    })
    .catch(() => {
      signingOut = false;
    });
}

// Turns a failed response into the error to throw, and catches an ended session on
// the way. Every request in this module reports its failure through here.
export async function apiFailure(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  if (res.status === 401) endSession();
  return new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`, body?.code);
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
  if (!res.ok) throw await apiFailure(res);
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
  // The optional sections, toggled by an owner in Settings -> General. Read through
  // useProjectFeatures, which hides the navigation and the section itself.
  initiativesEnabled: boolean;
  dashboardsEnabled: boolean;
  documentsEnabled: boolean;
  notesEnabled: boolean;
  cyclesEnabled: boolean;
  subtasksEnabled: boolean;
  checklistsEnabled: boolean;
  issueStatsEnabled: boolean;
  // Which estimate kinds the issues carry, set in Settings -> Configuration. Read
  // through useProjectFeatures, which hides the estimate rows and their display
  // properties while a kind is off.
  pointsEstimateEnabled: boolean;
  timeEstimateEnabled: boolean;
  // Whether members log the time they spend on the issues, set in the same place.
  // Independent of the time estimate.
  timeLoggingEnabled: boolean;
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
  | 'documents'
  | 'actions'
  | 'configuration'
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
  // How many issues the column should hold, or null for no limit. wipMode decides
  // whether passing it only warns on the board or is refused outright.
  wipLimit: number | null;
  wipMode: WipMode;
  // The member every issue entering this column is assigned to, replacing whoever
  // held it.
  autoAssignUserId: string | null;
}

export type WipMode = 'soft' | 'hard';

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
  // The handle they are mentioned by, @username. Null for a member who has none.
  username: string | null;
  image: string | null;
  kind: 'member' | 'agent';
  agentKind: 'external' | 'internal' | null;
  // The user an 'owner'-scoped agent works for: delegating it to anyone else queues a
  // run its runner never receives. Null for members and project-scoped agents.
  restrictedToUserId: string | null;
  // Whether this person may read issues and can therefore receive watcher
  // notifications without leaking work-item content.
  canReadWorkItems: boolean;
}

// One member custom field an agent reacts to, with the seconds its run waits.
export interface AgentFieldTrigger {
  fieldId: number;
  delaySec: number;
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
  // Run triggers.
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  // The member custom fields that start a run when the agent is set into one, each
  // with the seconds its run waits before the agent may pick it up.
  fieldTriggers: AgentFieldTrigger[];
  // How long a delegation run waits before the agent may pick it up.
  delegationDelaySec: number;
  // External-agent authorization role (a project_role id, or null for the default).
  roleId: number | null;
  // The member who created the agent, and whose runs an 'owner'-scoped runner is
  // limited to; 'project' scope serves any member's runs.
  ownerUserId: string | null;
  runnerScope: 'owner' | 'project';
  // When the agent's runner last polled, or null while none ever has.
  lastSeenAt: string | null;
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

// A run waits as 'pending' until a worker or a runner takes it; 'canceled' is a
// pending run ended by hand.
export type AgentRunStatus = 'pending' | 'success' | 'failed' | 'canceled';

// One row of an agent's autonomous run history. Issue-triggered runs reference an
// issue; scheduled and manual runs do not.
export interface AgentRun {
  id: number;
  status: AgentRunStatus;
  trigger: 'mention' | 'delegation' | 'field' | 'schedule' | 'manual';
  issueId: number | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
  prompt: string;
  attempts: number;
  lastError: string | null;
  output: string | null;
  // What the last model call of the run read and wrote: absent for a run that finished
  // before this was recorded and for one whose agent reports no counts.
  contextTokens?: number;
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
  lastRunStatus: AgentRunStatus | null;
  pendingRuns: number;
  // False when the agent's runner is scoped to another member, who alone may run or
  // stop it.
  canTrigger: boolean;
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
  status: AgentRunStatus;
  trigger: 'schedule' | 'manual';
  prompt: string;
  attempts: number;
  lastError: string | null;
  output: string | null;
  // What the last model call of the run read and wrote: absent for a run that finished
  // before this was recorded and for one whose agent reports no counts.
  contextTokens?: number;
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
  group: 'issues' | 'initiatives' | 'cycles' | 'notes' | 'project';
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
  fieldTriggers?: AgentFieldTrigger[];
  delegationDelaySec?: number;
  roleId?: number | null;
  runnerScope?: 'owner' | 'project';
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
  fieldTriggers?: AgentFieldTrigger[];
  delegationDelaySec?: number;
  roleId?: number | null;
  runnerScope?: 'owner' | 'project';
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

// 'llm' is an AI provider (its models an agent runs on, no tools); 'tool' is a tool
// integration whose `tools` are configured on a credential.
export type IntegrationKind = 'llm' | 'tool';

// An integration the project can store a credential for (server-side catalog).
export interface IntegrationMeta {
  key: string;
  label: string;
  kind: IntegrationKind;
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

// A connected integration as a picker option: what it is and what it is called,
// with none of the credential fields the admin list carries.
export interface IntegrationOption {
  id: number;
  integrationKey: string;
  kind: IntegrationKind;
  label: string | null;
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
  | { type: 'tool-start'; toolCallId: string; toolName: string; args?: string }
  // An external agent's runner sends a call's arguments after the call itself, in
  // pieces; an internal agent has them all at its start.
  | { type: 'tool-args'; toolCallId: string; delta: string }
  | { type: 'tool-end'; toolCallId: string; result?: string }
  | { type: 'done'; threadId: string | null }
  | { type: 'error'; message: string };

// One of the caller's saved chat conversations with an agent. `title` is the first
// prompt (truncated); null when it was never set. `cliSessionId` is the coding agent
// session an external agent's runner keeps for the thread on its own machine — null
// before the runner has reported one, and always null for an internal agent.
// `contextTokens` is the size of the conversation's context after its last completed
// answer: absent while no answer has completed, null where the agent reports no counts
// that can be read as one.
// `favorite` is the star the caller put on the conversation. `snippet` and `match` come
// back from a search: the text around the hit, and where it was found.
export interface AiChatThread {
  id: string;
  title: string | null;
  cliSessionId: string | null;
  contextTokens?: number | null;
  favorite: boolean;
  snippet?: string;
  match?: 'title' | 'user' | 'assistant';
  createdAt: string;
  updatedAt: string;
}

// One piece of a message, in the order the agent produced it: what it wrote, and the
// tools it called between one stretch of text and the next. A call carries what it was
// given and what it answered where the agent reported them.
export interface AiChatToolPart {
  type: 'tool';
  toolCallId: string;
  toolName: string;
  args?: string;
  result?: string;
}

export type AiChatPart = { type: 'text'; text: string } | AiChatToolPart;

// One restored message of a chat thread's transcript. `stopped` marks an answer the
// member ended part-way: what the agent had written by then is all there is.
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: AiChatPart[];
  createdAt: string;
  stopped?: boolean;
}

export interface AiChatThreadPage {
  items: AiChatThread[];
  nextPage: number | null;
}

export interface AiChatMessagePage {
  items: AiChatMessage[];
  nextPage: number | null;
}

// Streams an internal agent's response over SSE, yielding each AgentRunEvent as it
// arrives. Sends the session cookie like every other call. Throws ApiError when the
// request itself fails before the stream starts (e.g. 403/404); a failure during
// the run arrives as an `error` event, not a throw.
//
// The run is bound to this connection, so aborting `signal` is the whole stop: the API
// drops the run with it.
export async function* streamAiAgentRun(
  projectKey: string,
  agentId: number,
  input: { prompt: string; threadId?: string | null },
  signal?: AbortSignal,
): AsyncGenerator<AgentRunEvent> {
  const body = input.threadId
    ? { prompt: input.prompt, threadId: input.threadId }
    : { prompt: input.prompt };
  const res = await fetch(`${API_URL}/projects/${projectKey}/ai-agents/${agentId}/run/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  for await (const frame of readSseFrames(res)) {
    yield JSON.parse(frame.data) as AgentRunEvent;
  }
}

// The frames of one SSE connection: separated by a blank line, each carrying a single
// JSON-encoded event on its `data:` line and, on a resumable stream, the `id:` a
// reconnect resumes from. Throws ApiError when the request failed before the stream.
async function* readSseFrames(res: Response): AsyncGenerator<{ id: number | null; data: string }> {
  if (!res.ok || !res.body) throw await apiFailure(res);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const lines = buffer.slice(0, sep).split('\n');
      buffer = buffer.slice(sep + 2);
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const idLine = lines.find((l) => l.startsWith('id:'));
      yield {
        id: idLine ? Number(idLine.slice(3).trim()) : null,
        data: dataLine.slice(5).trim(),
      };
    }
  }
}

// --- Chat attachments: a file dropped in an agent chat, for an agent to read or
// import issues from.

export interface ChatAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

// The upload route takes the bytes as base64 rather than multipart, so the chat
// composer and an MCP client call the same route.
export async function uploadChatAttachment(
  projectKey: string,
  file: File,
): Promise<ChatAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
  return request(`/projects/${projectKey}/chat-attachments`, {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      contentType: file.type || undefined,
    }),
  });
}

// --- Issue imports: a chat attachment an agent mapped into issues, awaiting confirmation.

export interface IssueImport {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: 'mapped' | 'confirmed' | 'canceled' | 'failed';
  mapping: Record<string, string> | null;
  errorText: string | null;
  createdAt: string;
  preview?: {
    columns: { field: string; header: string }[];
    rows: { cells: string[]; skip: string | null }[];
    totalRows: number;
  };
}

export interface ImportConfirmResult {
  imported: { key: string; title: string }[];
  skipped: { row: number; reason: string }[];
}

export async function getImport(importId: string): Promise<IssueImport> {
  return request(`/imports/${importId}`);
}

export async function confirmImport(importId: string): Promise<ImportConfirmResult> {
  return request(`/imports/${importId}/confirm`, { method: 'POST' });
}

export async function discardImport(importId: string): Promise<void> {
  await request(`/imports/${importId}/cancel`, { method: 'POST' });
}

// What an external agent's runner reports while it answers, as AG-UI events
// (https://docs.ag-ui.com). Only the ones the chat renders are named; the rest of the
// protocol passes through and is ignored here.
interface AgUiEvent {
  type: string;
  delta?: string;
  content?: string;
  message?: string;
  toolCallId?: string;
  toolCallName?: string;
}

// How many times a dropped stream is picked up again. The answer keeps being produced
// on the operator's machine either way; this only decides how long the browser follows it.
const CHAT_STREAM_RETRIES = 3;

// Sends a message to an external agent and streams the answer its runner produces,
// yielding the same events as an internal agent's run so the chat consumes one shape.
// The answer starts only once a runner takes the message: until then the stream is open
// with nothing on it.
//
// Dropping the stream stops nothing here — the runner is on the operator's machine and
// only ever calls the API itself — so aborting `signal` also asks the API to cancel the
// answer, which is what the runner reads on its next report.
export async function* streamAiAgentChat(
  projectKey: string,
  agentId: number,
  input: { prompt: string; threadId?: string | null },
  signal?: AbortSignal,
): AsyncGenerator<AgentRunEvent> {
  const body = input.threadId
    ? { prompt: input.prompt, threadId: input.threadId }
    : { prompt: input.prompt };
  const sent = await request<{ threadId: string; messageId: number }>(
    `/projects/${projectKey}/ai-agents/${agentId}/chat`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  const chat = `/projects/${projectKey}/ai-agents/${agentId}/chat/${sent.messageId}`;
  const cancel = () => {
    // A stop the API refused leaves the answer being produced. The stream this belongs
    // to is already gone, so the console is the only place left to report it.
    request(`${chat}/cancel`, { method: 'POST' }).catch((err) => {
      console.error('Could not stop the answer', err);
    });
  };
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const base = `${API_URL}${chat}/stream`;
  let after = 0;
  // The answer always ends on a terminal event, so a stream that closed without one was
  // cut: pick it up again from the last event already shown.
  for (let attempt = 0; attempt <= CHAT_STREAM_RETRIES; attempt++) {
    let ended = false;
    try {
      const res = await fetch(`${base}?after=${after}`, { credentials: 'include', signal });
      for await (const frame of readSseFrames(res)) {
        after = frame.id ?? after;
        const event = JSON.parse(frame.data) as AgUiEvent;
        if (event.type === 'RUN_FINISHED') {
          ended = true;
          break;
        }
        if (event.type === 'RUN_ERROR') {
          ended = true;
          yield { type: 'error', message: event.message ?? 'The agent stopped answering' };
          break;
        }
        const mapped = toRunEvent(event);
        if (mapped) yield mapped;
      }
    } catch (err) {
      // A stop still has to name the thread: the reader binds it on `done`, and without
      // that the next message would open a second conversation.
      if (signal?.aborted) {
        yield { type: 'done', threadId: sent.threadId };
        throw err;
      }
      if (attempt === CHAT_STREAM_RETRIES) throw err;
    }
    if (ended) break;
  }
  yield { type: 'done', threadId: sent.threadId };
}

function toRunEvent(event: AgUiEvent): AgentRunEvent | null {
  switch (event.type) {
    case 'TEXT_MESSAGE_CONTENT':
      return { type: 'text', value: event.delta ?? '' };
    case 'TOOL_CALL_START':
      return {
        type: 'tool-start',
        toolCallId: event.toolCallId ?? '',
        toolName: event.toolCallName ?? '',
      };
    case 'TOOL_CALL_ARGS':
      return { type: 'tool-args', toolCallId: event.toolCallId ?? '', delta: event.delta ?? '' };
    // TOOL_CALL_END closes the call's arguments, which the runner reports in the same
    // batch as the call itself. The tool is done when its result arrives.
    case 'TOOL_CALL_RESULT':
      return { type: 'tool-end', toolCallId: event.toolCallId ?? '', result: event.content };
    default:
      return null;
  }
}

export type CustomFieldType =
  | 'text'
  | 'markdown'
  | 'url'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'datetime_range'
  | 'select'
  | 'multi_select'
  | 'member';

// Who a member field may hold: every candidate, the people only, or the agents only.
// Null for every other field type.
export type MemberScope = 'all' | 'humans' | 'agents';

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
  memberScope: MemberScope | null;
  // When true the field renders in the issue body (under the description);
  // when false it renders as a Properties row.
  showInBody: boolean;
  position: number;
  options: CustomFieldOption[];
}

// A preset a new issue can be created from: the title and description it starts
// with plus the properties applied on top of them. A property left null presets
// nothing — the create dialog keeps its own default for it.
export interface IssueTemplate {
  id: number;
  name: string;
  description: string;
  titleTemplate: string;
  descriptionTemplate: string;
  typeId: number | null;
  columnId: number | null;
  priority: string | null;
  assigneeUserId: string | null;
  labelIds: number[];
}

// One custom field value on a project issue: the scalar value (null for
// select/multi_select and unset fields), the end of a datetime_range, and the
// selected option ids. Only fields with a value set appear; unset fields are
// omitted (see listIssues).
export interface IssueFieldValueEntry {
  fieldId: number;
  value: string | number | boolean | null;
  valueEnd: string | null;
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
  initiative: InitiativeRef | null;
  // The cycle this issue is planned into, expanded to id + name for rendering, or
  // null. Set through updateIssue by cycleId.
  cycle: CycleRef | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  columnId: number;
  // The issue this one is a subtask of, or null when it stands on its own. The
  // views render a subtask under its parent instead of on its own, so an issue
  // with a parent never shows as a card or a row of its own.
  parentId: number | null;
  title: string;
  description: string;
  priority: string | null;
  // Time is in minutes; the UI enters and shows it as hours and minutes.
  estimatePoints: number | null;
  estimateMinutes: number | null;
  // The sum of the issue's logged time entries, 0 when nothing was logged. The
  // entries themselves are read separately (listWorklogs).
  loggedMinutes: number;
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
  // Unguessable token for the public read-only share link, or null when not shared.
  shareToken: string | null;
  // Whether that link exposes the issue in full (assignees, labels, custom fields,
  // activity) or only its title, description, state, type, priority, dates,
  // subtasks and links.
  shareExtended: boolean;
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
  cycleId: number | null;
  parentId: number | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  priority: string | null;
  dueDate: string | null;
  labelIds: number[];
  archived: boolean;
}

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

// Per-project repository integration settings, shared by every provider.
// webhookId is the path segment of the payload URL registered on the repository;
// secret authenticates its deliveries and is null for members who may read but not
// edit integrations. onMergeColumnId is where an issue closed by a merged pull
// request moves (null = the first completed state); onOpenColumnId is where an
// issue moves when a linked pull request is opened (null = no action).
export interface GitSettings {
  enabled: boolean;
  webhookId: string;
  secret: string | null;
  onMergeColumnId: number | null;
  onOpenColumnId: number | null;
  linkbackComments: boolean;
  repositories: GitRepository[];
}

// One repository that has delivered to the project, with the host it came from
// and when its last delivery arrived.
export interface GitRepository {
  repo: string;
  provider: string;
  lastEventAt: string;
}

export type GitConnectionProvider = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';

export interface GitManagedRepository {
  id: number;
  externalId: string;
  fullName: string;
  webUrl: string;
  status: 'connected' | 'error';
  lastError: string | null;
}

export interface GitProviderConnection {
  id: number;
  provider: GitConnectionProvider;
  baseUrl: string;
  accountLogin: string;
  repositories: GitManagedRepository[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailableGitRepository {
  externalId: string;
  fullName: string;
  webUrl: string;
  private: boolean;
  managedRepositoryId: number | null;
}

export interface AvailableGitRepositoryPage {
  repositories: AvailableGitRepository[];
  nextPage: number | null;
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

// A project's settings: MCP reachability and the enabled sections.
export interface ProjectSettings {
  mcpEnabled: boolean;
  features: ProjectFeatures;
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
export interface ProjectDefaults {
  mcpEnabled: boolean;
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

// One release. The ones above the running version come from the repository's feed
// and carry HTML notes; the ones up to it come from this build's changelog and
// carry markdown.
export interface Release {
  tag: string;
  version: string;
  publishedAt: string;
  url: string | null;
  notes: string;
  notesFormat: 'html' | 'markdown';
}

// How the running version compares to what is published. `latestVersion` and
// `checkedAt` are null until an upstream check has succeeded.
export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  releases: Release[];
}

// ── Instance administration (god mode) ────────────────────────────────────────

// Who may create an account on this instance.
export type RegistrationMode = 'open' | 'invite' | 'closed';

// The instance sign-in policy. hasEmailProvider tells whether outbound mail works;
// the options that depend on it cannot be turned on without one.
export interface InstanceAuthSettings {
  registration: RegistrationMode;
  requireEmailVerification: boolean;
  magicLink: boolean;
  emailPassword: boolean;
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

// SCIM provisioning. The token is never returned, only its prefix; a new one is
// generated with createInstanceScimToken and shown once.
export interface InstanceScimSettings {
  enabled: boolean;
  hasToken: boolean;
  tokenPrefix: string;
  baseUrl: string;
}

// What a provisioned group grants: membership in a project, at a role. The group and
// its members come from the identity provider; the mappings are set here.
export interface InstanceScimGroupMapping {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface InstanceScimGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  memberCount: number;
  mappings: InstanceScimGroupMapping[];
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
  // The custom roles a member of this project can be put on, for the SCIM group
  // mapping form.
  roles: { id: number; name: string; isDefault: boolean }[];
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
  // Whether the email/password form is offered at all. False only on an instance
  // that has a working single sign-on provider.
  emailPassword: boolean;
  google: boolean;
  oidc: boolean;
  // The sign-in button text the operator gave their identity provider. Empty when
  // OIDC is not offered, or when they left it blank.
  oidcLabel: string;
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
export type StartPage = 'inbox' | 'dashboard' | 'work-items' | 'initiatives';
export type IssueStatsView = 'compact' | 'timeline';
export type IssueActivityView = 'flat' | 'grouped';

export interface AccountPreferences {
  timezone: string;
  // The interface language. Mirrored into the NEXT_LOCALE cookie, which is what the
  // server renders with; also the language of this user's emails and bot messages.
  locale: Locale;
  theme: ThemePreference;
  issueOpenMode: IssueOpenMode;
  startPage: StartPage;
  showChatByDefault: boolean;
  // How the status stats section of an issue starts out, and the shape its activity
  // log starts in. Switching either on an issue is not saved — it lasts as long as
  // that issue stays open.
  issueStatsOpen: boolean;
  issueStatsView: IssueStatsView;
  issueActivityView: IssueActivityView;
  // Whether the user is subscribed to the issues they create, are assigned, comment
  // on or are mentioned in. Off means they only ever subscribe by hand.
  autoWatch: boolean;
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
// snapshot (layout + that layout's settings). The view itself is shared by the
// project; only `favorite` is per user. filters/display are stored as jsonb.
export interface View {
  id: number;
  projectId: number;
  name: string;
  icon: string | null;
  filters: FilterSet;
  display: SavedViewDisplay;
  position: number;
  // Unguessable token for the public read-only share link, or null when not shared.
  shareToken: string | null;
  // Whether the share link exposes the full issues (assignees, labels, custom
  // fields, activity) or only their title, description, state, type, priority,
  // dates, subtasks and links.
  shareExtended: boolean;
  // Whether the current user marked the view as a favorite: it pins the tab to the
  // front and lists the view under Work items in the sidebar.
  favorite: boolean;
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

// --- Note board DTOs -------------------------------------------------------------

// One sticky note on the canvas. body is markdown (may contain task-list items).
// color keys a background swatch defined by the UI. Declared as a type alias (not
// an interface) so it carries an implicit index signature and satisfies React
// Flow's Node data constraint (Record<string, unknown>).
export type NoteSticker = {
  title: string;
  body: string;
  color: string;
};

// A React Flow node holding a sticker. Kept structurally compatible with React
// Flow's Node so the canvas can use it directly.
export interface NoteNode {
  id: string;
  type: 'sticker';
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: NoteSticker;
}

// A connection between two stickers (React Flow edge).
export interface NoteEdge {
  id: string;
  source: string;
  target: string;
}

// The board canvas, stored verbatim as jsonb on the server.
export interface NoteCanvas {
  nodes: NoteNode[];
  edges: NoteEdge[];
}

// Who sees a board: every project member, its creator alone, or its creator plus
// the members granted access.
export type NoteBoardVisibility = 'public' | 'private' | 'restricted';

export interface NoteBoard {
  id: number;
  projectId: number;
  // null for a public board; a user id for a private or restricted one.
  ownerUserId: string | null;
  // Only the creator can change who sees the board.
  createdByUserId: string | null;
  visibility: NoteBoardVisibility;
  // The members granted access besides the creator (a restricted board).
  memberIds: string[];
  name: string;
  canvas: NoteCanvas;
  createdAt: string;
  updatedAt: string;
}

// A board without its canvas or member list — what the switcher and MRU tabs list.
// The canvas is loaded one board at a time via getNoteBoard when the board is opened.
export type NoteBoardSummary = Omit<NoteBoard, 'canvas' | 'memberIds'>;

export interface NewNoteBoardInput {
  name: string;
  visibility?: Exclude<NoteBoardVisibility, 'restricted'>;
  canvas?: NoteCanvas;
}

export interface NoteBoardPatch {
  name?: string;
  canvas?: NoteCanvas;
  visibility?: NoteBoardVisibility;
  // Replaces the granted members as a whole; only on a restricted board.
  memberIds?: string[];
}

// Someone a restricted board can be shared with. `canAccess` false means their
// role cannot read notes at all, so the API rejects granting them access.
export interface NoteBoardAccessCandidate {
  userId: string;
  name: string;
  image: string | null;
  kind: 'member' | 'agent';
  canAccess: boolean;
}

export interface NoteBoardListParams {
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectDocumentSummary {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  icon: string | null;
  metadata: Record<string, unknown>;
  fullWidth: boolean;
  isPrivate: boolean;
  isLocked: boolean;
  isFavorite: boolean;
  archivedAt: string | null;
  position: number;
  version: number;
  ownerUserId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument extends ProjectDocumentSummary {
  content: string;
  contentJson: Record<string, unknown> | null;
}

export interface DocumentIssueLink {
  issueId: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  archived: boolean;
  createdAt: string;
}

export interface IssueDocumentLink {
  documentId: number;
  title: string;
  icon: string | null;
  isPrivate: boolean;
  archived: boolean;
  createdAt: string;
}

export interface NewProjectDocumentInput {
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown> | null;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  fullWidth?: boolean;
  isPrivate?: boolean;
  parentId?: number | null;
}

export interface ProjectDocumentPatch {
  version: number;
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown> | null;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  fullWidth?: boolean;
  parentId?: number | null;
  position?: number;
  previousSiblingId?: number | null;
  nextSiblingId?: number | null;
}

export interface ProjectDocumentRevisionSummary {
  id: number;
  documentId: number;
  version: number;
  title: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ProjectDocumentRevision extends ProjectDocumentRevisionSummary {
  parentId: number | null;
  content: string;
  contentJson: Record<string, unknown> | null;
  icon: string | null;
  metadata: Record<string, unknown>;
  fullWidth: boolean;
  isPrivate: boolean;
  isLocked: boolean;
  archivedAt: string | null;
  position: number;
}

export interface ProjectDocumentExport {
  filename: string;
  mimeType: 'text/markdown';
  content: string;
  version: number;
  exportedAt: string;
}

export interface DocumentAsset {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: string;
  url: string;
}

function withDocumentAssetUrl(asset: DocumentAsset): DocumentAsset {
  const match = asset.url.match(
    /^\/projects\/([^/]+)\/documents\/(\d+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/raw$/i,
  );
  if (!match) throw new Error('The document asset URL returned by the API is invalid');
  const [, encodedProjectKey, documentId, publicId] = match;
  return {
    ...asset,
    url: `/protected-media/projects/${encodeURIComponent(decodeURIComponent(encodedProjectKey))}/documents/${documentId}/assets/${publicId}/raw`,
  };
}

async function sendDocumentAssetFile(
  projectKey: string,
  documentId: number,
  file: File,
): Promise<DocumentAsset> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/projects/${projectKey}/documents/${documentId}/assets`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw await apiFailure(res);
  return withDocumentAssetUrl(await res.json());
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
  status: AgentRunStatus;
  trigger: 'mention' | 'delegation' | 'field' | 'schedule' | 'manual';
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
  payload: ActivityPayload;
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

// Outgoing webhook subscription (mirrors apps/api modules/webhooks/service.ts). The event
// types must stay in sync with WEBHOOK_EVENT_TYPES on the server.
export type WebhookEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.assigned'
  | 'issue.state_changed'
  | 'issue.label_changed'
  | 'issue.link_changed'
  | 'comment.created';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.assigned',
  'issue.state_changed',
  'issue.label_changed',
  'issue.link_changed',
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

// `action` selects how the UI renders an activity row; the payload carries what
// changed (see ActivityPayload).
export type ActivityAction =
  | 'created'
  | 'title'
  | 'description'
  | 'status'
  | 'assignee'
  | 'delegate'
  | 'priority'
  | 'estimate'
  | 'type'
  | 'cycle'
  | 'start_date'
  | 'due_date'
  | 'label_add'
  | 'label_remove'
  | 'link_add'
  | 'link_remove'
  | 'parent'
  | 'subtask_add'
  | 'subtask_remove'
  | 'checklist_add'
  | 'checklist_rename'
  | 'checklist_remove'
  | 'checklist_item_add'
  | 'checklist_item_remove'
  | 'worklog'
  | 'field'
  | 'archived'
  | 'restored'
  | 'git_pr'
  // Entries recorded before the integration took other providers.
  | 'github_pr'
  | 'agent_started'
  | 'agent_finished';

// One side of a change: the display-ready text snapshot (column/label/type/assignee
// name, raw priority, ISO date, or the new text of a long field) and the id of the
// row behind it when the side names one. A status side also carries the state type
// its column had at the time, a pull request its repository and number.
export interface ActivitySide {
  value: string | null;
  id?: number | string | null;
  stateType?: string | null;
  repo?: string;
  number?: number;
  // A 'worklog' side carries the day its time was spent on.
  date?: string | null;
}

// What an activity row says changed. `subject` names the sub-item where the action
// alone is not enough (the custom field for 'field', the checklist of an item, the
// relation of a link); `from` and `to` are the two sides of the change. A side the
// action does not have is absent.
export interface ActivityPayload {
  subject?: ActivitySide;
  from?: ActivitySide;
  to?: ActivitySide;
}

// One entry in an issue's timeline. kind selects which fields are set: a 'comment'
// carries body; an 'activity' carries action and payload.
// actorName is the author/actor snapshot (null when it was never set).
export interface FeedItem {
  id: number;
  issueId: number;
  kind: 'comment' | 'activity';
  // The comment this one replies to, null for a top-level entry.
  replyToId: number | null;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: ActivityAction | null;
  payload: ActivityPayload;
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

// One stretch of the grouped feed: the status the issue was in, and the entries of
// this page written while it was there. `to` is null for the stretch it is in now,
// and `repeat` marks a status the issue had already been in earlier.
export interface FeedGroup {
  status: string | null;
  from: string;
  to: string | null;
  durationMs: number;
  repeat: boolean;
  items: FeedItem[];
}

// A page of the feed split into stretches. Paged by the same cursor as FeedPage, so a
// stretch that spans a page boundary arrives in both, each time with that page's
// entries.
export interface GroupedFeedPage {
  groups: FeedGroup[];
  nextCursor: FeedCursor | null;
}

// The query string both feed reads take, empty for the first page.
function feedPageQuery(params: { cursor?: FeedCursor | null; limit?: number }): string {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

// One stretch the issue spent in a single column. `status` is the column under the
// name it carries now, falling back to the name it had at the time once it is
// deleted (null only when the stretch recorded none); `to` is null for the stretch
// the issue is in now. The entries written inside a stretch are a separate read
// (listTimelineItems), made when one is opened.
export interface TimelineSegment {
  status: string | null;
  from: string;
  to: string | null;
  durationMs: number;
}

export interface IssueFieldValue {
  fieldId: number;
  name: string;
  fieldType: CustomFieldType;
  value: string | number | boolean | null;
  valueEnd: string | null;
  optionIds: number[];
}

// A custom field value on the way in (setFieldValue). `value` carries the
// scalar types, `valueEnd` the end of a datetime_range, `optionIds` the
// select/multi_select ones; a field uses one or the other.
export interface IssueFieldValueInput {
  value?: string | number | boolean | null;
  valueEnd?: string | null;
  optionIds?: number[];
}

// The caller's own role in a project (owner/member). Returned with the project;
// the resolved permission matrix is a sibling `permissions` field. See
// usePermissions.
export interface ProjectViewer {
  role: MemberRole;
}

// How an issue carries the initiative and the cycle it belongs to: the id plus
// what to render, and the initiative status the board orders its lanes by. The
// picker lists are InitiativeOption / CycleOption.
export interface InitiativeRef {
  id: number;
  title: string;
  status: InitiativeStatus;
}

// One cycle an issue was in. The cycle history of an issue is a list of these,
// oldest first.
export interface IssueCycleEntry {
  cycleId: number;
  name: string;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  enteredAt: string;
  leftAt: string | null;
}

export interface CycleRef {
  id: number;
  name: string;
  status: CycleStatus;
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
  issueTemplates: IssueTemplate[];
  viewer: ProjectViewer;
  // The caller's resolved permission matrix (owners get every flag).
  permissions: Permissions;
}

// An issue as a board carries it: with its relations to the project's other active
// issues. The board payload and the public share bundle have them; a write response
// returns a plain Issue.
export interface BoardIssue extends Issue {
  links: IssueLinkRef[];
  // How many subtasks the issue has, archived ones included. The board carries
  // only active issues, so an archived subtask shows up nowhere else — and a
  // delete or an archive still has to ask about it.
  subtaskCount: number;
}

export interface BoardIssues {
  issues: BoardIssue[];
}

// The scaffold composed with its issues and the project's unfinished cycles, as
// the Shell assembles it and passes it down. Downstream reads project.issues off
// this composite. `plannedCycles` is empty while the Cycles section is off and on a
// public share (whose bundle carries no cycle list).
export type ProjectDetail = ProjectScaffold & BoardIssues & { plannedCycles: CycleOption[] };

export interface IssueDetail extends Issue {
  fields: IssueFieldValue[];
}

export type GitProvider = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';
export type PullRequestState = 'open' | 'merged' | 'closed';
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';

export interface DevelopmentCheck {
  id: number;
  name: string;
  status: PipelineStatus;
  url: string | null;
  updatedAt: string;
}

export interface DevelopmentLink {
  id: number;
  provider: GitProvider;
  repository: string;
  kind: 'pull_request' | 'branch';
  number: number | null;
  title: string;
  url: string | null;
  state: PullRequestState;
  draft: boolean;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  pipelineStatus: PipelineStatus | null;
  pipelineUrl: string | null;
  checkStatus: PipelineStatus | null;
  checks: DevelopmentCheck[];
  updatedAt: string;
}

export interface DevelopmentRepository {
  id: number;
  provider: 'github' | 'gitlab';
  fullName: string;
  webUrl: string;
}

export interface LinkablePullRequest {
  number: number;
  title: string;
  url: string | null;
  state: PullRequestState;
  draft: boolean;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  updatedAt: string;
  linked: boolean;
}

export interface LinkablePullRequestPage {
  pullRequests: LinkablePullRequest[];
  nextPage: number | null;
}

export interface DevelopmentBranchPage {
  branches: string[];
  defaultBranch: string | null;
  nextPage: number | null;
}

export interface CreateIssuePullRequestInput {
  repositoryId: number;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
}

// A relation between two issues (mirrors apps/api modules/issues/links.ts). 'blocks' and
// 'duplicates' are directional and read differently on each end, which direction
// selects: 'outward' is the side that blocks/duplicates, 'inward' the side that is
// blocked/duplicated. On a symmetric 'relates' relation direction means nothing.
export type IssueLinkKind = 'blocks' | 'relates' | 'duplicates';
export type IssueLinkDirection = 'outward' | 'inward';

// What linkIssues accepts: the stored kinds plus the inverse reading of the two
// directional ones, so a relation can be stated from either end.
export type IssueLinkInputKind = IssueLinkKind | 'blocked_by' | 'duplicated_by';

export interface IssueLink {
  id: number;
  kind: IssueLinkKind;
  direction: IssueLinkDirection;
  // The issue on the other end of the relation.
  issue: IssueRef;
}

// One of an issue's relations as the board payload carries it: how the relation
// reads from this issue, and the id of the issue on the other end. Both ends
// carry it, each with its own reading; the views name the other end by looking
// the id up among the board's issues, which is why a relation to an archived
// issue is not sent.
export interface IssueLinkRef {
  id: number;
  relation: IssueLinkInputKind;
  issueId: number;
}

// A member following an issue: they receive every notification it produces.
export interface IssueWatcher {
  userId: string;
  name: string;
  image: string | null;
}

// Another issue named with the state it is in: an issue's parent, one of its
// subtasks, or the other end of a relation.
export interface IssueRef {
  id: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  columnId: number;
  typeId: number | null;
  archived: boolean;
}

// What a delete or an archive does with the issue's subtasks: they follow it
// (deleted with a delete, archived with an archive), they are detached into
// ordinary issues, or they move to another parent. Required whenever the issue
// being removed has subtasks.
export type SubtaskMode = 'cascade' | 'detach' | 'reassign';

export interface SubtaskDisposition {
  subtasks: SubtaskMode;
  newParentId?: number;
}

// One checkbox line of a checklist.
export interface ChecklistItem {
  id: number;
  content: string;
  done: boolean;
  position: number;
}

// A checklist on an issue: steps too small to be subtasks of their own. Both the
// checklists of an issue and the items of a checklist come back in display order.
export interface Checklist {
  id: number;
  title: string;
  position: number;
  items: ChecklistItem[];
}

// One entry of the time a member logged on an issue: how long they worked, the day
// the work happened on, an optional note, and the member it belongs to. The time an
// issue took is the sum of its entries (Issue.loggedMinutes).
export interface Worklog {
  id: number;
  issueId: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  minutes: number;
  spentOn: string;
  note: string | null;
  createdAt: string;
}

// What a new entry carries. A change sends the same fields, any subset of them.
export interface WorklogInput {
  minutes: number;
  spentOn: string;
  note?: string | null;
}

// The issue with its relations and its place in the subtask hierarchy. Shared
// pages carry this much; the detail routes add the watchers and the checklists,
// neither of which a public page exposes.
export interface IssueRelations extends IssueDetail {
  links: IssueLink[];
  parent: IssueRef | null;
  subtasks: IssueRef[];
}

// The issue as the detail routes return it.
export interface IssueWithWatchers extends IssueRelations {
  watchers: IssueWatcher[];
  checklists: Checklist[];
  development: DevelopmentLink[];
}

// Public read-only share bundles, returned by the /share/* routes with no session.
// The scaffold mirrors ProjectScaffold minus the caller's viewer/permissions and
// member emails and handles (a public page shows names and avatars only).
export type PublicScaffold = Omit<ProjectScaffold, 'viewer' | 'permissions' | 'assignees'> & {
  assignees: Omit<Assignee, 'email' | 'username' | 'canReadWorkItems'>[];
};

export interface SharedIssueBundle {
  project: PublicScaffold;
  issue: IssueRelations;
  feed: FeedItem[];
}

export interface SharedViewBundle {
  project: PublicScaffold;
  // The view's own filters stay on the server: it has already applied them to the
  // issues below, and they can name assignees, labels and custom field values a
  // link without `extended` withholds.
  view: {
    name: string;
    icon: string | null;
    display: SavedViewDisplay;
    // Whether the link exposes the full issues or only their title, description,
    // state, type, priority, dates, subtasks and links.
    extended: boolean;
  };
  issues: BoardIssue[];
}

export interface NewIssueInput {
  typeId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  columnId: number;
  parentId?: number | null;
  title: string;
  description?: string;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
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
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface IssuePatch {
  columnId?: number;
  position?: number;
  typeId?: number | null;
  parentId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  title?: string;
  description?: string;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
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

// An initiative as a picker option, for linking an issue to one.
export interface InitiativeOption {
  id: number;
  title: string;
  status: InitiativeStatus;
}

// A time-boxed period of work (a sprint). status follows from the dates against
// today, unless the cycle was finished ahead of them; progress follows from the
// linked issues' states.
export type CycleStatus = 'upcoming' | 'active' | 'completed';

// A cycle as a picker option, for planning an issue into one.
export interface CycleOption {
  id: number;
  name: string;
  status: CycleStatus;
}

export interface CycleProgress {
  completed: number;
  canceled: number;
  total: number;
}

export interface Cycle {
  id: number;
  projectId: number;
  name: string;
  // What the team commits to in this cycle (the sprint goal). Empty when unset.
  goal: string;
  startDate: string;
  endDate: string;
  // When the cycle was finished ahead of its planned end date, or null. endDate
  // keeps the date it was planned to run until either way.
  completedAt: string | null;
  status: CycleStatus;
  createdAt: string;
  updatedAt: string;
  progress: CycleProgress;
}

// One page of the finished cycles. `total` counts all of them, so the archive can
// say how many there are without loading them.
export interface CyclePage {
  items: Cycle[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewCycleInput {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export interface CyclePatch {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

// Columns the initiative list can be sorted by, server-side. progress and health
// are derived and not sortable.
export const INITIATIVE_SORTS = ['title', 'priority', 'targetDate', 'owner'] as const;

export type InitiativeSort = (typeof INITIATIVE_SORTS)[number];

export interface InitiativeListParams {
  statuses?: string[];
  search?: string;
  sort?: InitiativeSort;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InitiativePage {
  items: Initiative[];
  total: number;
  page: number;
  pageSize: number;
}

// Per-status initiative counts for the list's status tabs.
export interface InitiativeCounts {
  total: number;
  proposed: number;
  planned: number;
  active: number;
  completed: number;
  canceled: number;
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
  payload: ActivityPayload;
  createdAt: string;
  issueId: number | null;
  issueIdentifier: string | null;
}

export interface InitiativeFeedPage {
  items: InitiativeFeedItem[];
  nextCursor: FeedCursor | null;
}

// A field can be reshaped after it exists, and the values issues hold follow: a new
// fieldType clears them, a narrowed memberScope clears the ones it no longer allows,
// and an option missing from `options` is deleted along with the selections of it.
export interface CustomFieldPatch {
  name?: string;
  showInBody?: boolean;
  fieldType?: CustomFieldType;
  memberScope?: MemberScope;
  // The full option list of a select field, in display order. An entry with an id
  // renames that option; one without is new.
  options?: { id?: number; value: string }[];
}

export interface NewCustomFieldInput {
  issueTypeId?: number | null;
  name: string;
  fieldType: CustomFieldType;
  memberScope?: MemberScope;
  showInBody?: boolean;
  options?: string[];
}

export interface NewIssueTemplateInput {
  name: string;
  description?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  typeId?: number | null;
  columnId?: number | null;
  priority?: string | null;
  assigneeUserId?: string | null;
  labelIds?: number[];
}

// A property left out keeps its value; `labelIds` replaces the whole label set.
export type IssueTemplatePatch = Partial<NewIssueTemplateInput>;

// The project permission matrix (mirrors apps/api shared/permissions.ts): each
// resource grants or denies 4 actions. A custom role carries one matrix.
export type PermissionAction = 'create' | 'edit' | 'read' | 'delete';

export type PermissionResource =
  | 'work_items'
  | 'initiatives'
  | 'cycles'
  | 'dashboards'
  | 'documents'
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
  | 'issue_templates'
  | 'workflow_config'
  | 'actions'
  | 'webhooks'
  | 'note_boards'
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
  // The sign-in name. null for an AI agent's bot user, which never gets one.
  username: string | null;
  image: string | null;
  // The zone this member reads timestamps in, from their preferences.
  timezone: string;
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
  // 'scim' when a provisioned group granted this membership. The sync rewrites such
  // a row on every run, so the role and remove actions are refused for it.
  source: 'invite' | 'scim';
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

export interface InviteCreateResult extends InviteRow {
  emailQueued: boolean;
}

export interface InviteEmailResult {
  emailQueued: boolean;
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

// The attachment DTO's url is relative to the API origin; point it at the web
// origin's media route so it works in <img>/<video> and markdown rendered there.
function withMediaUrl(a: Attachment): Attachment {
  return { ...a, url: mediaUrl(a.url) };
}

// Multipart upload — cannot use request(), which forces a JSON Content-Type; the
// browser must set the multipart boundary itself, so no headers are set.
async function sendAttachmentFile(
  path: string,
  method: 'POST' | 'PUT',
  file: File,
): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, { method, credentials: 'include', body: form });
  if (!res.ok) throw await apiFailure(res);
  return withMediaUrl(await res.json());
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
  // Only a 'state_changed' notification has them.
  fromState: string | null;
  toState: string | null;
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

// The subtask disposition as the delete route takes it: a query string, since a
// DELETE carries no body.
function subtaskQuery(disposition?: SubtaskDisposition): string {
  if (!disposition) return '';
  const qs = new URLSearchParams({ subtasks: disposition.subtasks });
  if (disposition.newParentId != null) qs.set('newParentId', String(disposition.newParentId));
  return `?${qs.toString()}`;
}

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
  // The board's issues and their relations.
  getBoardIssues: (projectKey: string) =>
    request<BoardIssues>(`/projects/${projectKey}/issues/board`),
  // The change markers of every scope the client is watching, in one request.
  // Polled by the sync provider; see utils/revScopes.
  getRevs: (scopes: string[]) =>
    request<{ revs: Record<string, string> }>(`/sync/rev?scopes=${scopes.join(',')}`),

  createColumn: (
    projectKey: string,
    input: {
      name: string;
      stateType: StateType;
      color?: string;
      wipLimit?: number | null;
      wipMode?: WipMode;
      autoAssignUserId?: string | null;
    },
  ) =>
    request<Column>(`/projects/${projectKey}/columns`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateColumn: (
    projectKey: string,
    columnId: number,
    patch: {
      name?: string;
      stateType?: StateType;
      color?: string;
      // null clears the limit; absent leaves it as it is.
      wipLimit?: number | null;
      wipMode?: WipMode;
      // null clears the automatic assignment; absent leaves it as it is.
      autoAssignUserId?: string | null;
    },
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

  createCustomField: (projectKey: string, input: NewCustomFieldInput) =>
    request<CustomField>(`/projects/${projectKey}/custom-fields`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCustomField: (projectKey: string, fieldId: number, patch: CustomFieldPatch) =>
    request<CustomField>(`/projects/${projectKey}/custom-fields/${fieldId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteCustomField: (projectKey: string, fieldId: number) =>
    request<void>(`/projects/${projectKey}/custom-fields/${fieldId}`, { method: 'DELETE' }),

  createIssueTemplate: (projectKey: string, input: NewIssueTemplateInput) =>
    request<IssueTemplate>(`/projects/${projectKey}/issue-templates`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateIssueTemplate: (projectKey: string, templateId: number, patch: IssueTemplatePatch) =>
    request<IssueTemplate>(`/projects/${projectKey}/issue-templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteIssueTemplate: (projectKey: string, templateId: number) =>
    request<void>(`/projects/${projectKey}/issue-templates/${templateId}`, { method: 'DELETE' }),

  createIssue: (projectKey: string, input: NewIssueInput) =>
    request<Issue>(`/projects/${projectKey}/issues`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getIssue: (id: number) => request<IssueWithWatchers>(`/issues/${id}`),
  listIssueCycles: (id: number) => request<IssueCycleEntry[]>(`/issues/${id}/cycles`),

  // Public read-only sharing. Enabling returns the link token and sets how much it
  // exposes; calling it again on a shared entity keeps the link and only changes
  // that. Disable revokes it. The getShared* reads need no session (public
  // /share/* routes).
  enableIssueShare: (id: number, extended: boolean) =>
    request<{ token: string }>(`/issues/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ extended }),
    }),
  disableIssueShare: (id: number) => request<void>(`/issues/${id}/share`, { method: 'DELETE' }),
  enableViewShare: (id: number, extended: boolean) =>
    request<{ token: string }>(`/views/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ extended }),
    }),
  disableViewShare: (id: number) => request<void>(`/views/${id}/share`, { method: 'DELETE' }),
  getSharedIssue: (token: string) => request<SharedIssueBundle>(`/share/issue/${token}`),
  getSharedView: (token: string) => request<SharedViewBundle>(`/share/view/${token}`),
  getSharedViewIssue: (token: string, issueId: number) =>
    request<SharedIssueBundle>(`/share/view/${token}/issues/${issueId}`),
  // Resolve an issue by its project-scoped number (the human "42" in the URL).
  getIssueBySeq: (projectKey: string, seq: number) =>
    request<IssueWithWatchers>(`/projects/${projectKey}/issues/${seq}`),
  updateIssue: (id: number, patch: IssuePatch) =>
    request<Issue>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeIssueDevelopmentLink: (issueId: number, linkId: number) =>
    request<void>(`/issues/${issueId}/development/${linkId}`, { method: 'DELETE' }),
  listIssueDevelopmentRepositories: (issueId: number) =>
    request<DevelopmentRepository[]>(`/issues/${issueId}/development/repositories`),
  listLinkablePullRequests: (
    issueId: number,
    repositoryId: number,
    input: { state: 'open' | 'all'; page: number },
  ) =>
    request<LinkablePullRequestPage>(
      `/issues/${issueId}/development/repositories/${repositoryId}/pull-requests?${new URLSearchParams(
        { state: input.state, page: String(input.page) },
      )}`,
    ),
  listDevelopmentBranches: (issueId: number, repositoryId: number, page: number) =>
    request<DevelopmentBranchPage>(
      `/issues/${issueId}/development/repositories/${repositoryId}/branches?page=${page}`,
    ),
  linkIssueDevelopment: (issueId: number, input: { repositoryId: number; number: number }) =>
    request<DevelopmentLink>(`/issues/${issueId}/development`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createIssuePullRequest: (issueId: number, input: CreateIssuePullRequestInput) =>
    request<DevelopmentLink>(`/issues/${issueId}/development/pull-requests`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // An issue that has subtasks needs a disposition saying what happens to them;
  // without one the server rejects the delete with a 409.
  deleteIssue: (id: number, subtasks?: SubtaskDisposition) =>
    request<void>(`/issues/${id}${subtaskQuery(subtasks)}`, { method: 'DELETE' }),
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
  bulkArchiveIssues: (projectKey: string, ids: number[], subtasks?: SubtaskDisposition) =>
    request<{ archived: number }>(`/projects/${projectKey}/issues/bulk/archive`, {
      method: 'POST',
      body: JSON.stringify({ ids, ...subtasks }),
    }),
  bulkDeleteIssues: (projectKey: string, ids: number[], subtasks?: SubtaskDisposition) =>
    request<{ deleted: number }>(`/projects/${projectKey}/issues/bulk/delete`, {
      method: 'POST',
      body: JSON.stringify({ ids, ...subtasks }),
    }),
  // Archive/restore: hide an issue from the board (kept, restorable) or bring it
  // back. The board excludes archived issues; the archive settings section lists them.
  archiveIssue: (id: number, subtasks?: SubtaskDisposition) =>
    request<Issue>(`/issues/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify(subtasks ?? {}),
    }),
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
  // Relations between issues. The relation reads from the issue in the path: it
  // blocks / relates to / duplicates targetIssueId. Both ends show it.
  linkIssues: (issueId: number, targetIssueId: number, kind: IssueLinkInputKind) =>
    request<IssueLink>(`/issues/${issueId}/links`, {
      method: 'POST',
      body: JSON.stringify({ targetIssueId, kind }),
    }),
  unlinkIssues: (issueId: number, linkId: number) =>
    request<void>(`/issues/${issueId}/links/${linkId}`, { method: 'DELETE' }),

  // Following an issue. The singular routes act on the signed-in user; the
  // watcher routes let an editor curate other project members. Every route
  // returns the resulting watcher list.
  watchIssue: (issueId: number) =>
    request<IssueWatcher[]>(`/issues/${issueId}/watch`, { method: 'POST' }),
  unwatchIssue: (issueId: number) =>
    request<IssueWatcher[]>(`/issues/${issueId}/watch`, { method: 'DELETE' }),
  addIssueWatcher: (issueId: number, userId: string) =>
    request<IssueWatcher[]>(`/issues/${issueId}/watchers/${userId}`, { method: 'PUT' }),
  removeIssueWatcher: (issueId: number, userId: string) =>
    request<IssueWatcher[]>(`/issues/${issueId}/watchers/${userId}`, { method: 'DELETE' }),

  setFieldValue: (issueId: number, fieldId: number, input: IssueFieldValueInput) =>
    request<{ ok: boolean }>(`/issues/${issueId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  // Checklists on an issue. The issue read already carries them, so there is no
  // list call of their own — a write refreshes that read.
  createChecklist: (issueId: number, title: string) =>
    request<Checklist>(`/issues/${issueId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  renameChecklist: (checklistId: number, title: string) =>
    request<Checklist>(`/checklists/${checklistId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteChecklist: (checklistId: number) =>
    request<void>(`/checklists/${checklistId}`, { method: 'DELETE' }),
  reorderChecklists: (issueId: number, orderedIds: number[]) =>
    request<Checklist[]>(`/issues/${issueId}/checklists/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  createChecklistItem: (checklistId: number, content: string) =>
    request<ChecklistItem>(`/checklists/${checklistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  updateChecklistItem: (itemId: number, patch: { content?: string; done?: boolean }) =>
    request<ChecklistItem>(`/checklists/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteChecklistItem: (itemId: number) =>
    request<void>(`/checklists/items/${itemId}`, { method: 'DELETE' }),
  reorderChecklistItems: (checklistId: number, orderedIds: number[]) =>
    request<ChecklistItem[]>(`/checklists/${checklistId}/items/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  // The time logged on an issue. Unlike the checklists these are not part of the
  // issue read — it carries their sum, and only the section listing them needs the
  // entries.
  listWorklogs: (issueId: number) => request<Worklog[]>(`/issues/${issueId}/worklogs`),
  createWorklog: (issueId: number, input: WorklogInput) =>
    request<Worklog>(`/issues/${issueId}/worklogs`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateWorklog: (worklogId: number, patch: Partial<WorklogInput>) =>
    request<Worklog>(`/worklogs/${worklogId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteWorklog: (worklogId: number) =>
    request<void>(`/worklogs/${worklogId}`, { method: 'DELETE' }),

  listAttachments: (issueId: number) =>
    request<Attachment[]>(`/issues/${issueId}/attachments`).then((rows) => rows.map(withMediaUrl)),
  uploadAttachment: (issueId: number, file: File) =>
    sendAttachmentFile(`/issues/${issueId}/attachments`, 'POST', file),
  // Keeps the attachment's id and URL, so an embed of it in a description shows
  // the new file.
  replaceAttachment: (publicId: string, file: File) =>
    sendAttachmentFile(`/attachments/${publicId}`, 'PUT', file),
  deleteAttachment: (publicId: string) =>
    request<void>(`/attachments/${publicId}`, { method: 'DELETE' }),

  listFeed: (issueId: number, params: { cursor?: FeedCursor | null; limit?: number } = {}) =>
    request<FeedPage>(`/issues/${issueId}/feed${feedPageQuery(params)}`),
  // The same page, split into the stretches the issue spent in one status.
  listGroupedFeed: (issueId: number, params: { cursor?: FeedCursor | null; limit?: number } = {}) =>
    request<GroupedFeedPage>(`/issues/${issueId}/feed/grouped${feedPageQuery(params)}`),
  listTimeline: (issueId: number) => request<TimelineSegment[]>(`/issues/${issueId}/timeline`),
  // The entries of one stretch of the timeline: [from, to), open-ended without `to`.
  listTimelineItems: (issueId: number, from: string, to: string | null) => {
    const q = new URLSearchParams({ from });
    if (to) q.set('to', to);
    return request<FeedItem[]>(`/issues/${issueId}/timeline/items?${q.toString()}`);
  },
  createComment: (issueId: number, input: { body: string; replyToId?: number }) =>
    request<FeedItem>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Initiatives — collection ops take projectKey; ops on one initiative take its
  // own id and hit /initiatives/:id (like issues).
  listInitiatives: (projectKey: string, params: InitiativeListParams = {}) => {
    const q = new URLSearchParams();
    if (params.statuses && params.statuses.length) q.set('status', params.statuses.join(','));
    if (params.search) q.set('search', params.search);
    if (params.sort) q.set('sort', params.sort);
    if (params.dir) q.set('dir', params.dir);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return request<InitiativePage>(`/projects/${projectKey}/initiatives${qs ? `?${qs}` : ''}`);
  },
  listInitiativeOptions: (projectKey: string, params: { search?: string; include?: number }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.include) q.set('include', String(params.include));
    const qs = q.toString();
    return request<InitiativeOption[]>(
      `/projects/${projectKey}/initiatives/options${qs ? `?${qs}` : ''}`,
    );
  },
  initiativeCounts: (projectKey: string) =>
    request<InitiativeCounts>(`/projects/${projectKey}/initiatives/counts`),
  getInitiative: (id: number) => request<Initiative>(`/initiatives/${id}`),
  createInitiative: (projectKey: string, input: NewInitiativeInput) =>
    request<Initiative>(`/projects/${projectKey}/initiatives`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateInitiative: (id: number, patch: InitiativePatch) =>
    request<Initiative>(`/initiatives/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteInitiative: (id: number) => request<void>(`/initiatives/${id}`, { method: 'DELETE' }),
  listInitiativeFeed: (id: number, params: { cursor?: FeedCursor | null; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
    const qs = q.toString();
    return request<InitiativeFeedPage>(`/initiatives/${id}/feed${qs ? `?${qs}` : ''}`);
  },

  // Cycles — same shape as initiatives: the list takes projectKey, ops on one cycle
  // take its own id and hit /cycles/:id.
  listCycles: (projectKey: string) => request<Cycle[]>(`/projects/${projectKey}/cycles`),
  listPlannedCycles: (projectKey: string) =>
    request<Cycle[]>(`/projects/${projectKey}/cycles?status=planned`),
  listCycleOptions: (projectKey: string) =>
    request<CycleOption[]>(`/projects/${projectKey}/cycles/options`),
  listCompletedCycles: (projectKey: string, params: { page: number; pageSize: number }) =>
    request<CyclePage>(
      `/projects/${projectKey}/cycles/completed?page=${params.page}&pageSize=${params.pageSize}`,
    ),
  getCycle: (id: number) => request<Cycle>(`/cycles/${id}`),
  createCycle: (projectKey: string, input: NewCycleInput) =>
    request<Cycle>(`/projects/${projectKey}/cycles`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCycle: (id: number, patch: CyclePatch) =>
    request<Cycle>(`/cycles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCycle: (id: number) => request<void>(`/cycles/${id}`, { method: 'DELETE' }),
  transferCycleIssues: (id: number, targetCycleId: number | null) =>
    request<{ moved: number }>(`/cycles/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ targetCycleId }),
    }),
  finishCycle: (id: number) => request<Cycle>(`/cycles/${id}/finish`, { method: 'POST' }),
  startNextCycle: (id: number) =>
    request<{ cycle: Cycle; moved: number }>(`/cycles/${id}/start-next`, { method: 'POST' }),

  listViews: (projectKey: string) => request<View[]>(`/projects/${projectKey}/views`),
  createView: (projectKey: string, input: NewViewInput) =>
    request<View>(`/projects/${projectKey}/views`, { method: 'POST', body: JSON.stringify(input) }),
  updateView: (viewId: number, patch: ViewPatch) =>
    request<View>(`/views/${viewId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteView: (viewId: number) => request<void>(`/views/${viewId}`, { method: 'DELETE' }),
  setViewFavorite: (viewId: number, favorite: boolean) =>
    request<void>(`/views/${viewId}/favorite`, { method: favorite ? 'PUT' : 'DELETE' }),
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

  // Note boards — all ops are project-scoped (a board that is not public is
  // filtered to who may see it server-side), so board ops take projectKey plus the
  // board id. The list is paged and searchable (switcher); a single board carries
  // its canvas.
  listNoteBoards: (projectKey: string, params: NoteBoardListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<NoteBoardSummary[]>(`/projects/${projectKey}/note-boards${suffix}`);
  },
  getNoteBoard: (projectKey: string, boardId: number) =>
    request<NoteBoard>(`/projects/${projectKey}/note-boards/${boardId}`),
  listNoteBoardAccessCandidates: (projectKey: string) =>
    request<NoteBoardAccessCandidate[]>(`/projects/${projectKey}/note-boards/access-candidates`),
  createNoteBoard: (projectKey: string, input: NewNoteBoardInput) =>
    request<NoteBoard>(`/projects/${projectKey}/note-boards`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateNoteBoard: (projectKey: string, boardId: number, patch: NoteBoardPatch) =>
    request<NoteBoard>(`/projects/${projectKey}/note-boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteNoteBoard: (projectKey: string, boardId: number) =>
    request<void>(`/projects/${projectKey}/note-boards/${boardId}`, { method: 'DELETE' }),

  listDocuments: (projectKey: string, q?: string, archived = false) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (archived) params.set('archived', 'true');
    const suffix = params.size > 0 ? `?${params}` : '';
    return request<ProjectDocumentSummary[]>(`/projects/${projectKey}/documents${suffix}`);
  },
  getDocument: (projectKey: string, documentId: number) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}`),
  listDocumentIssueLinks: (projectKey: string, documentId: number) =>
    request<DocumentIssueLink[]>(`/projects/${projectKey}/documents/${documentId}/issues`),
  listIssueDocumentLinks: (projectKey: string, issueId: number) =>
    request<IssueDocumentLink[]>(`/projects/${projectKey}/documents/for-issue/${issueId}`),
  linkDocumentIssue: (projectKey: string, documentId: number, issueId: number) =>
    request<DocumentIssueLink>(`/projects/${projectKey}/documents/${documentId}/issues`, {
      method: 'POST',
      body: JSON.stringify({ issueId }),
    }),
  unlinkDocumentIssue: (projectKey: string, documentId: number, issueId: number) =>
    request<void>(`/projects/${projectKey}/documents/${documentId}/issues/${issueId}`, {
      method: 'DELETE',
    }),
  createDocument: (projectKey: string, input: NewProjectDocumentInput) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateDocument: (projectKey: string, documentId: number, patch: ProjectDocumentPatch) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteDocument: (projectKey: string, documentId: number, version: number) =>
    request<void>(`/projects/${projectKey}/documents/${documentId}?version=${version}`, {
      method: 'DELETE',
    }),
  setDocumentAccess: (
    projectKey: string,
    documentId: number,
    input: { version: number; isPrivate: boolean },
  ) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/access`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  setDocumentLocked: (projectKey: string, documentId: number, version: number, locked: boolean) =>
    request<ProjectDocument>(
      `/projects/${projectKey}/documents/${documentId}/${locked ? 'lock' : 'unlock'}`,
      { method: 'POST', body: JSON.stringify({ version }) },
    ),
  archiveDocument: (projectKey: string, documentId: number, version: number) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    }),
  restoreDocument: (projectKey: string, documentId: number, version: number) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    }),
  duplicateDocument: (
    projectKey: string,
    documentId: number,
    input: { version: number; title?: string; parentId?: number | null },
  ) =>
    request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  setDocumentFavorite: (projectKey: string, documentId: number, isFavorite: boolean) =>
    request<{ isFavorite: boolean }>(
      `/projects/${projectKey}/documents/${documentId}/preferences`,
      { method: 'PATCH', body: JSON.stringify({ isFavorite }) },
    ),
  listDocumentRevisions: (projectKey: string, documentId: number) =>
    request<ProjectDocumentRevisionSummary[]>(
      `/projects/${projectKey}/documents/${documentId}/revisions`,
    ),
  getDocumentRevision: (projectKey: string, documentId: number, revisionId: number) =>
    request<ProjectDocumentRevision>(
      `/projects/${projectKey}/documents/${documentId}/revisions/${revisionId}`,
    ),
  restoreDocumentRevision: (
    projectKey: string,
    documentId: number,
    revisionId: number,
    version: number,
  ) =>
    request<ProjectDocument>(
      `/projects/${projectKey}/documents/${documentId}/revisions/${revisionId}/restore`,
      { method: 'POST', body: JSON.stringify({ version }) },
    ),
  exportDocument: (projectKey: string, documentId: number) =>
    request<ProjectDocumentExport>(`/projects/${projectKey}/documents/${documentId}/export`),
  listDocumentAssets: (projectKey: string, documentId: number) =>
    request<DocumentAsset[]>(`/projects/${projectKey}/documents/${documentId}/assets`).then(
      (assets) => assets.map(withDocumentAssetUrl),
    ),
  uploadDocumentAsset: (projectKey: string, documentId: number, file: File) =>
    sendDocumentAssetFile(projectKey, documentId, file),
  deleteDocumentAsset: (projectKey: string, documentId: number, publicId: string) =>
    request<void>(
      `/projects/${projectKey}/documents/${documentId}/assets/${encodeURIComponent(publicId)}`,
      { method: 'DELETE' },
    ),

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
  // Ends the schedule's waiting runs — all of them, or the one given.
  cancelAgentScheduleRuns: (projectKey: string, scheduleId: number, runId?: number) =>
    request<{ canceled: number }>(
      `/projects/${projectKey}/agent-schedules/${scheduleId}/runs${runId != null ? `/${runId}` : ''}/cancel`,
      { method: 'POST' },
    ),
  // One page of the caller's own chat threads with an agent, newest first. `q` searches
  // them by title and message text instead, over every page.
  listAiAgentThreads: (projectKey: string, agentId: number, page: number, q = '') =>
    request<AiChatThreadPage>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads?page=${page}` +
        (q ? `&q=${encodeURIComponent(q)}` : ''),
    ),
  // The conversations the caller starred with an agent, newest first, in one go.
  listAiAgentFavoriteThreads: (projectKey: string, agentId: number) =>
    request<AiChatThreadPage>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads?favorites=true`,
    ),
  // Stars one of the caller's conversations, or takes the star off it.
  setAiAgentThreadFavorite: (
    projectKey: string,
    agentId: number,
    threadId: string,
    favorite: boolean,
  ) =>
    request<void>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}/favorite`,
      { method: favorite ? 'PUT' : 'DELETE' },
    ),
  // The transcript of one chat thread, to restore the conversation.
  getAiAgentThreadMessages: (projectKey: string, agentId: number, threadId: string, page: number) =>
    request<AiChatMessagePage>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}/messages?page=${page}`,
    ),
  // Renames one of the caller's chat threads.
  renameAiAgentThread: (projectKey: string, agentId: number, threadId: string, title: string) =>
    request<void>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}`,
      { method: 'PATCH', body: JSON.stringify({ title }) },
    ),
  deleteAiAgentThread: (projectKey: string, agentId: number, threadId: string) =>
    request<void>(
      `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}`,
      { method: 'DELETE' },
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
  listIntegrationOptions: (projectKey: string, kind?: IntegrationKind) =>
    request<IntegrationOption[]>(
      `/projects/${projectKey}/integrations/options${kind ? `?kind=${kind}` : ''}`,
    ),
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
  // Multipart upload for a skill reference — see sendAttachmentFile for why
  // request() cannot be used.
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
    if (!res.ok) throw await apiFailure(res);
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

  // Invites — owner side: create, list, email, and revoke a project's invite links.
  listInvites: (projectKey: string) => request<InviteRow[]>(`/projects/${projectKey}/invites`),
  createInvite: (
    projectKey: string,
    input: { email: string; role: MemberRole; roleId?: number | null },
  ) =>
    request<InviteCreateResult>(`/projects/${projectKey}/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  sendInviteEmail: (projectKey: string, inviteId: number) =>
    request<InviteEmailResult>(`/projects/${projectKey}/invites/${inviteId}/email`, {
      method: 'POST',
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

  // The action list any project member may read; the permissioned list route is
  // for API/MCP callers.
  listQuickActions: (projectKey: string) =>
    request<ActionDef[]>(`/projects/${projectKey}/actions/quick`),
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

  // Project settings: MCP reachability and the enabled sections. Owner-only; the
  // current state comes with the project payload (getProject), so there is no read
  // here.
  updateProjectSettings: (
    projectKey: string,
    patch: { mcpEnabled?: boolean; features?: Partial<ProjectFeatures> },
  ) =>
    request<ProjectSettings>(`/projects/${projectKey}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // The workflow configuration (workflow_config: read to view, edit to change):
  // the auto-archive thresholds, the subtask automations, and the estimate kinds.
  // The estimate kinds have no read of their own — they come with the project.
  getAutoArchive: (projectKey: string) =>
    request<AutoArchiveSettings>(`/projects/${projectKey}/settings/auto-archive`),
  updateAutoArchive: (projectKey: string, input: AutoArchiveSettings) =>
    request<AutoArchiveSettings>(`/projects/${projectKey}/settings/auto-archive`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  getSubtaskAutomation: (projectKey: string) =>
    request<SubtaskAutomationSettings>(`/projects/${projectKey}/settings/subtasks`),
  updateSubtaskAutomation: (projectKey: string, input: SubtaskAutomationSettings) =>
    request<SubtaskAutomationSettings>(`/projects/${projectKey}/settings/subtasks`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  updateEstimates: (projectKey: string, input: EstimateSettings) =>
    request<EstimateSettings>(`/projects/${projectKey}/settings/estimates`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  // The repository integration (integrations: read to view, edit to change).
  getGitSettings: (projectKey: string) =>
    request<GitSettings>(`/projects/${projectKey}/settings/git`),
  updateGitSettings: (
    projectKey: string,
    patch: {
      enabled?: boolean;
      onMergeColumnId?: number | null;
      onOpenColumnId?: number | null;
      linkbackComments?: boolean;
    },
  ) =>
    request<GitSettings>(`/projects/${projectKey}/settings/git`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  regenerateGitSecret: (projectKey: string) =>
    request<GitSettings>(`/projects/${projectKey}/settings/git/secret`, {
      method: 'POST',
    }),
  listGitProviderConnections: (projectKey: string) =>
    request<GitProviderConnection[]>(`/projects/${projectKey}/settings/git/connections`),
  connectGitProvider: (
    projectKey: string,
    input: { provider: GitConnectionProvider; baseUrl?: string; token: string },
  ) =>
    request<GitProviderConnection>(`/projects/${projectKey}/settings/git/connections`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  disconnectGitProvider: (projectKey: string, connectionId: number) =>
    request<void>(`/projects/${projectKey}/settings/git/connections/${connectionId}`, {
      method: 'DELETE',
    }),
  listAvailableGitRepositories: (
    projectKey: string,
    connectionId: number,
    params: { page?: number; search?: string },
  ) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.search) query.set('search', params.search);
    return request<AvailableGitRepositoryPage>(
      `/projects/${projectKey}/settings/git/connections/${connectionId}/repositories?${query}`,
    );
  },
  connectGitRepositories: (projectKey: string, connectionId: number, externalIds: string[]) =>
    request<GitProviderConnection>(
      `/projects/${projectKey}/settings/git/connections/${connectionId}/repositories`,
      { method: 'POST', body: JSON.stringify({ externalIds }) },
    ),
  disconnectGitRepository: (projectKey: string, connectionId: number, repositoryId: number) =>
    request<void>(
      `/projects/${projectKey}/settings/git/connections/${connectionId}/repositories/${repositoryId}`,
      { method: 'DELETE' },
    ),

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
  getAccountPreferences: (locale: Locale) =>
    request<AccountPreferences>('/account/preferences', {
      headers: { 'Accept-Language': locale },
    }),
  updateAccountPreferences: (input: AccountPreferencesPatch, locale: Locale) =>
    request<AccountPreferences>('/account/preferences', {
      method: 'PATCH',
      headers: { 'Accept-Language': locale },
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
  // Unread count for the sidebar badge, refetched when the inbox scope moves.
  getUnreadCount: (projectId: number) =>
    request<{ unread: number }>(`/notifications/unread?projectId=${projectId}`),
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
  testInstanceEmailSettings: (patch: InstanceEmailSettingsPatch) =>
    request<InstanceEmailTestResult>('/god/email-settings/test', {
      method: 'POST',
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

  // The running version, shown in the sidebar to every signed-in user.
  getAppVersion: () => request<{ version: string }>('/settings/version'),

  // Whether a newer release exists, and the release notes behind it. God mode: the
  // instance owner is the one who upgrades.
  getUpdateStatus: () => request<UpdateStatus>('/god/updates'),
  checkForUpdates: () => request<UpdateStatus>('/god/updates/check', { method: 'POST' }),

  getInstanceProjectDefaults: () => request<ProjectDefaults>('/god/project-defaults'),
  updateInstanceProjectDefaults: (body: ProjectDefaults) =>
    request<ProjectDefaults>('/god/project-defaults', {
      method: 'PUT',
      body: JSON.stringify(body),
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
  getInstanceOidcSettings: () => request<InstanceOidcSettings>('/god/oidc-settings'),
  updateInstanceOidcSettings: (patch: InstanceOidcSettingsPatch) =>
    request<InstanceOidcSettings>('/god/oidc-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  getInstanceScimSettings: () => request<InstanceScimSettings>('/god/scim-settings'),
  updateInstanceScimSettings: (patch: { enabled: boolean }) =>
    request<InstanceScimSettings>('/god/scim-settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  // Returns the new token in the clear. It is shown once and cannot be read back.
  createInstanceScimToken: () =>
    request<{ token: string }>('/god/scim-settings/token', { method: 'POST' }),

  listInstanceScimGroups: () => request<InstanceScimGroup[]>('/god/scim-groups'),
  setInstanceScimGroupMappings: (
    groupId: string,
    mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
  ) =>
    request<InstanceScimGroup>(`/god/scim-groups/${groupId}/mappings`, {
      method: 'PUT',
      body: JSON.stringify({ mappings }),
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
