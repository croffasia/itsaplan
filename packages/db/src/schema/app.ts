// Task planner tables: projects, workflow columns, issue types, labels, custom
// fields, issues, and their dependent rows. Exposed to the web app over HTTP by
// the API.
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// Global key-value settings for the instance, not scoped to a project. The value is
// a jsonb blob owned by whatever feature reads the key, so one table backs many
// settings.
export const appSetting = pgTable('app_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Instance-wide secrets, the encrypted counterpart of app_setting. One row per key
// (e.g. 'auth.email' for the instance mail provider); the value is a JSON blob
// encrypted as a whole, so a key can hold several credentials. `redacted` mirrors the
// same blob with every secret replaced by a boolean, for the settings UI to read
// without decrypting. Encryption is AES-256-GCM with APP_ENCRYPTION_KEY — changing
// that env value makes stored rows undecryptable.
export const appSecret = pgTable('app_secret', {
  key: text('key').primaryKey(),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  redacted: jsonb('redacted').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// A project groups its own columns, issue types, labels, custom fields, and
// issues. next_sequence is the atomic counter behind each issue's human
// identifier (e.g. "MKT-42"): incrementing it under a row lock keeps concurrent
// creates from colliding.
export const project = pgTable('project', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  nextSequence: integer('next_sequence').notNull().default(1),
  // Whether this project is reachable through the MCP server. Off by default: an
  // owner opts a project in before agents can work with it over MCP.
  mcpEnabled: boolean('mcp_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Per-project key-value settings, mirroring app_setting but scoped to a project.
// The value is a jsonb blob owned by whatever feature reads the key, so one table
// backs many project settings (e.g. auto-archive thresholds under key
// 'auto_archive'). Composite PK (project_id, key).
export const projectSetting = pgTable(
  'project_setting',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.key] })],
);

// A user's own interface preferences, held per account rather than per project so
// the same choices apply on every device. timezone is an IANA zone name used by the
// web app to render stored UTC timestamps; the API keeps storing and returning UTC.
// theme is 'light' | 'dark' | 'system', issue_open_mode is 'panel' | 'page' (how a
// clicked issue opens), start_page is the section the app root lands on. Absent row
// means the user has not changed anything and the defaults below apply.
// last_project_id is the project the user was in last, so the app root reopens it
// after signing in on any device; the FK clears it when that project is deleted.
// show_chat_by_default keeps the floating AI chat button on screen from the start,
// with the chat window collapsed. hotkeys holds the keyboard shortcuts this user
// rebound.
export const userPreference = pgTable(
  'user_preference',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    timezone: text('timezone').notNull().default('UTC'),
    theme: text('theme').notNull().default('system'),
    issueOpenMode: text('issue_open_mode').notNull().default('panel'),
    startPage: text('start_page').notNull().default('work-items'),
    showChatByDefault: boolean('show_chat_by_default').notNull().default(false),
    // The user's own keyboard shortcut overrides, as { hotkeyId: combo }. Only the
    // bindings they changed are stored; the rest come from the instance defaults
    // (app_setting key 'hotkeys') and then the built-in ones.
    hotkeys: jsonb('hotkeys').$type<Record<string, string>>(),
    lastProjectId: integer('last_project_id').references(() => project.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('user_preference_theme_check', sql`${t.theme} IN ('light', 'dark', 'system')`),
    check('user_preference_issue_open_mode_check', sql`${t.issueOpenMode} IN ('panel', 'page')`),
    check(
      'user_preference_start_page_check',
      sql`${t.startPage} IN ('inbox', 'dashboard', 'work-items', 'initiatives', 'ai-chat')`,
    ),
  ],
);

// Custom roles per project. A role carries a permission matrix: for each
// resource (work_items, dashboards, ...) the create/edit/read/delete flags. The
// matrix is a jsonb blob owned and enforced by the API (see
// apps/api/src/shared/permissions.ts). Exactly one role per project is the
// default ("Member"): it is assigned to members that join through an invite and
// is the fallback for a member row with no explicit role. Owners bypass roles
// entirely (they always have full access), so their project_member.role_id stays
// NULL.
export const projectRole = pgTable(
  'project_role',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    permissions: jsonb('permissions').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.name),
    // At most one default role per project.
    uniqueIndex('project_role_default_uq')
      .on(t.projectId)
      .where(sql`${t.isDefault}`),
    index('project_role_project_idx').on(t.projectId),
  ],
);

// Project membership: which users can access a project and their role in it.
// A user reaches a project's columns, issues, labels, and every other
// project-scoped entity only through a row here. The creator is inserted as
// "owner"; a project can have several owners. Owners always have full access and
// manage the member list. A "member" row carries role_id pointing at a
// project_role whose permission matrix decides what that member may do; a NULL
// role_id falls back to the project's default role. Access checks resolve the
// owning project of any entity and look for the current user here.
export const projectMember = pgTable(
  'project_member',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    roleId: integer('role_id').references(() => projectRole.id, {
      onDelete: 'set null',
    }),
    // What this member does in the project. Free text set by an owner, shown on the
    // members page and given to agents so they can pick who to tag on an unassigned
    // issue. Empty string when unset.
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    check('project_member_role_check', sql`${t.role} IN ('owner', 'member')`),
    index('project_member_user_idx').on(t.userId),
  ],
);

// Project invites: a shareable link (token) that grants a specific email a
// specific role in a project once accepted. The role is the owner/member flag
// plus, for a member, role_id naming which custom role they join on. An owner
// creates an invite; the
// invited person opens the link and accepts (only if their session email matches
// invite.email) or rejects it. Accepting creates the project_member row. At most
// one pending invite per (project, email) — enforced by the partial unique index.
// email is stored lowercased. Revoking a pending invite removes its row.
export const projectInvite = pgTable(
  'project_invite',
  {
    id: serial('id').primaryKey(),
    token: uuid('token').notNull().defaultRandom().unique(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    // The custom role the invitee joins on when role is "member". NULL falls back
    // to the project's default role. Owners bypass roles, so an owner invite keeps
    // this NULL.
    roleId: integer('role_id').references(() => projectRole.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('pending'),
    invitedByUserId: text('invited_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    acceptedByUserId: text('accepted_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    check('project_invite_role_check', sql`${t.role} IN ('owner', 'member')`),
    check('project_invite_status_check', sql`${t.status} IN ('pending', 'accepted', 'rejected')`),
    // At most one pending invite per project + email.
    uniqueIndex('project_invite_pending_uq')
      .on(t.projectId, t.email)
      .where(sql`${t.status} = 'pending'`),
    index('project_invite_project_idx').on(t.projectId),
  ],
);

export const projectColumn = pgTable(
  'project_column',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    stateType: text('state_type').notNull().default('unstarted'),
    color: text('color').notNull().default('#6b7280'),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'project_column_state_type_check',
      sql`${t.stateType} IN ('backlog', 'unstarted', 'started', 'completed', 'canceled')`,
    ),
    unique().on(t.projectId, t.position),
  ],
);

export const issueType = pgTable(
  'issue_type',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon').notNull().default(''),
    color: text('color').notNull().default('#6b7280'),
    isDefault: boolean('is_default').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.name)],
);

// Optional container a label can belong to. A label has at most one group;
// deleting a group ungroups its labels (label.groupId -> SET NULL).
export const labelGroup = pgTable(
  'label_group',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6b7280'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.name)],
);

export const label = pgTable(
  'label',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').references(() => labelGroup.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6b7280'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.name)],
);

// AI agents attached to a project. Each agent is backed by a hidden bot user
// (user_id -> user.id): that user is what a work item is delegated to, what a
// comment/activity is authored by, and what owns the agent's API key (better-auth
// apikey.reference_id points at it). An external agent needs only a name (on the
// bot user) + username and a key; an internal agent additionally carries a model
// configuration (provider/model/instructions/tools) used to run it. What an agent
// may do is governed by the tools it is granted, not by a project role — an agent
// is not a project_member.
export const aiAgent = pgTable(
  'ai_agent',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    kind: text('kind').notNull(),
    // Internal-agent model configuration. NULL/empty for an external agent.
    // model_credential_id references the integration_credential (kind 'llm') the
    // runtime decrypts to address the model; model names the model id on it.
    modelCredentialId: integer('model_credential_id').references(() => integrationCredential.id, {
      onDelete: 'set null',
    }),
    model: text('model'),
    instructions: text('instructions'),
    // Enabled capability-tool keys (from the code tool registry). System tools
    // that act on the API with the agent's own token are implicit and not listed.
    tools: jsonb('tools').notNull().default([]),
    temperature: doublePrecision('temperature'),
    maxSteps: integer('max_steps'),
    // Internal-agent run triggers. A mention in a comment enqueues a run when
    // trigger_on_mention is set; being set as an issue's delegate enqueues one when
    // trigger_on_assign is set.
    triggerOnMention: boolean('trigger_on_mention').notNull().default(true),
    triggerOnAssign: boolean('trigger_on_assign').notNull().default(false),
    // Authorization: the project_role the bot user acts under. Every agent request
    // carries its API key and is enforced by this role through the normal permission
    // checks — an external agent's HTTP calls and an internal agent's in-process tool
    // dispatch alike. NULL means the bot user has no membership yet and cannot act.
    roleId: integer('role_id').references(() => projectRole.id, { onDelete: 'set null' }),
    // The agent's own API key, encrypted at rest (AES-256-GCM, see shared/crypto).
    // An internal agent replays it on every tool call, so unlike better-auth's
    // hashed apikey row it has to stay recoverable. Set for internal agents only:
    // an external agent's key is held by whoever drives it and is never stored here.
    apiKeyCiphertext: text('api_key_ciphertext'),
    apiKeyIv: text('api_key_iv'),
    apiKeyAuthTag: text('api_key_auth_tag'),
    // Conversation memory: when enabled, the agent recalls the last
    // memory_last_messages messages of a thread (persisted by Mastra's Postgres
    // store). memory_last_messages is NULL when memory is off.
    memoryEnabled: boolean('memory_enabled').notNull().default(false),
    memoryLastMessages: integer('memory_last_messages'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.username),
    unique().on(t.userId),
    check('ai_agent_kind_check', sql`${t.kind} IN ('external', 'internal')`),
    index('ai_agent_project_idx').on(t.projectId),
  ],
);

// Recurring autonomous tasks for internal agents. The worker claims rows whose
// next_run_at is due, advances the cadence, and inserts an agent_run snapshot.
export const agentSchedule = pgTable(
  'agent_schedule',
  {
    id: serial('id').primaryKey(),
    agentId: integer('agent_id')
      .notNull()
      .references(() => aiAgent.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prompt: text('prompt').notNull(),
    cron: text('cron').notNull(),
    timezone: text('timezone').notNull(),
    status: text('status').notNull().default('active'),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('agent_schedule_status_check', sql`${t.status} IN ('active', 'paused')`),
    unique().on(t.agentId, t.name),
    index('agent_schedule_due_idx').on(t.status, t.nextRunAt),
    index('agent_schedule_agent_idx').on(t.agentId),
  ],
);

// Queued autonomous runs of an internal agent. Mentions and delegations carry an
// issue; scheduled and manual runs do not. The worker claims due rows with a lease,
// runs the agent, and records the result for history and retries.
export const agentRun = pgTable(
  'agent_run',
  {
    id: serial('id').primaryKey(),
    agentId: integer('agent_id')
      .notNull()
      .references(() => aiAgent.id, { onDelete: 'cascade' }),
    issueId: integer('issue_id').references(() => issue.id, { onDelete: 'cascade' }),
    scheduleId: integer('schedule_id').references(() => agentSchedule.id, { onDelete: 'set null' }),
    trigger: text('trigger').notNull().default('delegation'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    // The comment that mentioned the agent, kept for traceability. The prompt is
    // snapshotted into `prompt` so a run still works if the comment is later deleted.
    sourceActivityId: integer('source_activity_id').references(() => issueActivity.id, {
      onDelete: 'set null',
    }),
    // The mention comment body at enqueue time, framed into the agent's prompt.
    prompt: text('prompt').notNull(),
    // pending -> success | failed. Like webhook_delivery, a claim keeps the row
    // 'pending' and pushes next_attempt_at forward by a lease, so a run whose poller
    // crashes mid-flight becomes claimable again after the lease expires.
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    output: text('output'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('agent_run_status_check', sql`${t.status} IN ('pending', 'success', 'failed')`),
    check(
      'agent_run_trigger_check',
      sql`${t.trigger} IN ('mention', 'delegation', 'schedule', 'manual')`,
    ),
    uniqueIndex('agent_run_schedule_fire_uq').on(t.scheduleId, t.scheduledFor),
    index('agent_run_due_idx').on(t.status, t.nextAttemptAt),
    index('agent_run_schedule_idx').on(t.scheduleId),
  ],
);

// Stored credentials for a project's integrations. One store for every secret: the
// API keys of LLM providers (kind 'llm', addressed by an internal agent's model) and
// the credentials of tool integrations (kind 'tool', bound to configured tools).
// integration_key names the integration in the catalog; the credential's fields (and
// which are secret) come from that integration's credentialSchema. The full
// credential object is stored encrypted (AES-256-GCM, see
// apps/api/src/shared/crypto.ts): ciphertext + iv + auth_tag. `redacted` is the same
// object with secret fields masked, kept in plaintext for a masked display. The
// secret is never returned to the client. A project may hold several credentials per
// integration (e.g. two Jina keys), told apart by `label`.
export const integrationCredential = pgTable(
  'integration_credential',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    integrationKey: text('integration_key').notNull(),
    label: text('label'),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    // The credential with secret fields masked; non-secret fields verbatim. Owned by
    // the store, derived from the integration's credential schema.
    redacted: jsonb('redacted').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('integration_credential_project_idx').on(t.projectId)],
);

// Per-project notification provider credentials: the outbound channels the project
// can deliver through (SMTP or Resend for email, a Telegram bot). One row per
// project, managed by an owner. The config carries secrets (SMTP password, Resend
// API key, Telegram bot token), so it is stored encrypted (AES-256-GCM, see
// apps/api/src/shared/crypto.ts): ciphertext + iv + auth_tag. `redacted` is the
// same config with secret values dropped, kept in plaintext so the settings UI can
// render the non-secret fields and show which secrets are set. Secrets are never
// returned to the client. The plaintext config is read only by the delivery sender.
// Which events reach a given member is a per-user choice held in
// user_notification_preference, not here. The Telegram bot token here is optional: a
// project that sets one delivers through its own bot, otherwise delivery falls back
// to the instance bot in app_secret key 'telegram.bot'.
export const projectNotificationSetting = pgTable('project_notification_setting', {
  projectId: integer('project_id')
    .primaryKey()
    .references(() => project.id, { onDelete: 'cascade' }),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  redacted: jsonb('redacted').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// A member's own notification preferences for one project: for each issue event
// type, whether they want it by email and/or Telegram. One row per (user, project);
// absent means the member has not opted in and receives nothing.
// email_events/telegram_events are EventToggles jsonb keyed by the four inbox
// notification types (assigned/mentioned/commented/state_changed). Email is sent to
// the member's account address; Telegram to the chat of the account they linked in
// user_telegram_account, which is instance-wide rather than per project.
export const userNotificationPreference = pgTable(
  'user_notification_preference',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    emailEvents: jsonb('email_events').notNull().default({}),
    telegramEvents: jsonb('telegram_events').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('user_notification_pref_user_project_unique').on(t.userId, t.projectId)],
);

// The Telegram account a user has linked, instance-wide (one row per user, whatever
// the project). Linking runs through the instance bot: the user asks for a link, the
// row is created with a one-time link_code, and the bot fills chat_id when that code
// arrives as `/start <code>`. So the row is "pending" while chat_id is null and
// "linked" once it is set — link_code is cleared at that point. chat_id is unique, so
// one Telegram account cannot serve two product accounts.
export const userTelegramAccount = pgTable(
  'user_telegram_account',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: text('chat_id'),
    // Display only, refreshed on every link: what to show the user so they can tell
    // which Telegram account this is. A Telegram account may have no @username.
    username: text('username'),
    firstName: text('first_name'),
    linkCode: text('link_code'),
    linkCodeExpiresAt: timestamp('link_code_expires_at', { withTimezone: true }),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_telegram_account_chat_id_unique')
      .on(t.chatId)
      .where(sql`${t.chatId} IS NOT NULL`),
    uniqueIndex('user_telegram_account_link_code_unique')
      .on(t.linkCode)
      .where(sql`${t.linkCode} IS NOT NULL`),
  ],
);

// Outbox for outbound notification delivery. One row per (recipient, channel,
// message) to send for an issue event: an email or a Telegram message to one member.
// Rows are enqueued when inbox notifications are created (see
// apps/api/src/notifications/outbound.ts) and drained by the worker following the
// same claim/retry pattern as webhook_delivery. The message text is composed at
// enqueue time and stored in `payload`; the channel credentials are read from
// project_notification_setting at send time. channel is 'email' | 'telegram'
// ('email' picks SMTP or Resend from the project config). recipient is the member's
// email address for email rows, or their Telegram chat id for telegram rows.
export const notificationDelivery = pgTable(
  'notification_delivery',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    recipient: text('recipient'),
    // Composed message: { subject?, text, html?, url? }. Owned by the sender.
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('notification_delivery_channel_check', sql`${t.channel} IN ('email', 'telegram')`),
    // Backs the worker's claim query: due pending rows ordered by next_attempt_at.
    index('notification_delivery_due_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

// Skill library for a project. A skill is a unit of knowledge given to an internal
// agent (Anthropic Agent Skill format): a SKILL.md with YAML frontmatter
// (name/description) plus optional reference files, no executable scripts. The
// markdown and reference bytes live in the S3 object store under s3_prefix; `files`
// lists the reference file paths and their object keys. Sourced from an upload,
// inline text, or a GitHub URL. Enabled on an agent via agent_skill_link.
export const agentSkill = pgTable(
  'agent_skill',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    source: text('source').notNull(),
    sourceUrl: text('source_url'),
    // Object-store prefix holding SKILL.md and reference files for this skill.
    s3Prefix: text('s3_prefix').notNull(),
    // Reference files beyond SKILL.md: [{ path, s3Key, size }]. Owned by the store.
    files: jsonb('files').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.name),
    check('agent_skill_source_check', sql`${t.source} IN ('upload', 'inline', 'github')`),
    index('agent_skill_project_idx').on(t.projectId),
  ],
);

// Which skills are enabled on which agents (many-to-many). Deleting an agent or a
// skill removes the link.
export const agentSkillLink = pgTable(
  'agent_skill_link',
  {
    agentId: integer('agent_id')
      .notNull()
      .references(() => aiAgent.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => agentSkill.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.skillId] }),
    index('agent_skill_link_skill_idx').on(t.skillId),
  ],
);

// A custom tool configured in a project: a tool from the catalog (tool_key) bound to
// one integration_credential. The tool's integration owns the secret, so the tool
// holds no secret of its own — it references the credential the runtime decrypts at
// call time. Different tools of the same integration may be bound to different
// credentials (e.g. two Jina keys). Enabled on an agent via agent_tool_link.
export const agentTool = pgTable(
  'agent_tool',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    toolKey: text('tool_key').notNull(),
    credentialId: integer('credential_id')
      .notNull()
      .references(() => integrationCredential.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.toolKey, t.credentialId),
    index('agent_tool_project_idx').on(t.projectId),
    index('agent_tool_credential_idx').on(t.credentialId),
  ],
);

// Which configured tools are enabled on which agents (many-to-many). Deleting an
// agent or a configured tool removes the link.
export const agentToolLink = pgTable(
  'agent_tool_link',
  {
    agentId: integer('agent_id')
      .notNull()
      .references(() => aiAgent.id, { onDelete: 'cascade' }),
    agentToolId: integer('agent_tool_id')
      .notNull()
      .references(() => agentTool.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.agentToolId] }),
    index('agent_tool_link_tool_idx').on(t.agentToolId),
  ],
);

// Custom fields. Always scoped to a project. A NULL issue_type_id applies the
// field to every issue in that project; a non-null issue_type_id scopes it to
// that one type.
export const customField = pgTable(
  'custom_field',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    issueTypeId: integer('issue_type_id').references(() => issueType.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    fieldType: text('field_type').notNull(),
    // When true the field renders in the issue body (under the description),
    // like a second description; when false it renders as a Properties row.
    showInBody: boolean('show_in_body').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'custom_field_field_type_check',
      sql`${t.fieldType} IN ('text', 'markdown', 'url', 'number', 'boolean', 'date', 'select', 'multi_select')`,
    ),
  ],
);

export const customFieldOption = pgTable(
  'custom_field_option',
  {
    id: serial('id').primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => customField.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    color: text('color').notNull().default('#6b7280'),
    position: integer('position').notNull().default(0),
  },
  (t) => [unique().on(t.fieldId, t.value)],
);

// A strategic grouping of issues inside a project (project-scoped, not
// cross-project). Issues point at it through issue.initiative_id. status is a
// fixed lifecycle enum; health is not stored — it is computed on the fly from the
// initiative's issue progress against its timeline. owner_user_id is the person
// accountable. start_date/target_date bound the timeline (start defaults to
// created_at when null); priority mirrors issue.priority (free text).
export const initiative = pgTable(
  'initiative',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('planned'),
    ownerUserId: text('owner_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    priority: text('priority'),
    startDate: date('start_date'),
    targetDate: date('target_date'),
    position: doublePrecision('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'initiative_status_check',
      sql`${t.status} IN ('proposed', 'planned', 'active', 'completed', 'canceled')`,
    ),
    index('initiative_project_idx').on(t.projectId, t.position),
  ],
);

// Labels attached to an initiative. Reuses the project's labels (label table);
// mirrors issue_label. Composite PK, no id, no timestamps.
export const initiativeLabel = pgTable(
  'initiative_label',
  {
    initiativeId: integer('initiative_id')
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    labelId: integer('label_id')
      .notNull()
      .references(() => label.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.initiativeId, t.labelId] })],
);

export const issue = pgTable(
  'issue',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    sequenceNumber: integer('sequence_number').notNull(),
    typeId: integer('type_id').references(() => issueType.id, {
      onDelete: 'set null',
    }),
    // The initiative this issue belongs to (project-scoped). Nullable; deleting an
    // initiative unlinks its issues rather than deleting them (like type_id).
    initiativeId: integer('initiative_id').references(() => initiative.id, {
      onDelete: 'set null',
    }),
    columnId: integer('column_id')
      .notNull()
      .references(() => projectColumn.id),
    assigneeUserId: text('assignee_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    // The AI agent an issue is delegated to. Like assignee this points at a bot
    // user (ai_agent.user_id); assignee holds a project member, delegate holds an
    // agent. Setting a delegate on an internal agent with trigger_on_assign enqueues
    // an agent run.
    delegateUserId: text('delegate_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    priority: text('priority'),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    position: doublePrecision('position').notNull().default(0),
    // When set, the issue is archived: hidden from the board and lists but kept and
    // restorable. Set manually (archive action) or by the worker's auto-archive
    // sweep for issues that sat in a completed/canceled column past the project's
    // configured threshold. NULL means active (on the board).
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.sequenceNumber),
    // Backs the board/list read (active issues of a project) and the worker's
    // auto-archive sweep (still-active issues in a project).
    index('issue_project_active_idx')
      .on(t.projectId, t.columnId)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

export const issueLabel = pgTable(
  'issue_label',
  {
    issueId: integer('issue_id')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    labelId: integer('label_id')
      .notNull()
      .references(() => label.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);

export const issueFieldValue = pgTable(
  'issue_field_value',
  {
    id: serial('id').primaryKey(),
    issueId: integer('issue_id')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => customField.id, { onDelete: 'cascade' }),
    valueText: text('value_text'),
    valueNumber: numeric('value_number'),
    valueBool: boolean('value_bool'),
    valueDate: date('value_date'),
  },
  (t) => [unique().on(t.issueId, t.fieldId)],
);

export const issueFieldOption = pgTable(
  'issue_field_option',
  {
    issueId: integer('issue_id')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => customField.id, { onDelete: 'cascade' }),
    optionId: integer('option_id')
      .notNull()
      .references(() => customFieldOption.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.fieldId, t.optionId] })],
);

// File attachments on issues. Bytes live in the S3-compatible object store;
// this table holds metadata and the object key. public_id is the unguessable id
// used in the public download URL.
export const issueAttachment = pgTable(
  'issue_attachment',
  {
    id: serial('id').primaryKey(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    issueId: integer('issue_id')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    s3Key: text('s3_key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('issue_attachment_issue_idx').on(t.issueId)],
);

// Timeline of comments and change-log activity for issues and initiatives, in one
// table. Each row belongs to exactly one owner: an issue (issue_id) or an
// initiative (initiative_id) — enforced by owner_check. kind selects which payload
// columns a row uses — a comment sets body; activity sets action/subject/from_text/
// to_text. actor_user_id is the author, taken from the session user (a member or an
// agent's bot user). actor_name is a snapshot so an entry still reads correctly
// after that user is renamed or deleted.
export const issueActivity = pgTable(
  'issue_activity',
  {
    id: serial('id').primaryKey(),
    issueId: integer('issue_id').references(() => issue.id, {
      onDelete: 'cascade',
    }),
    initiativeId: integer('initiative_id').references(() => initiative.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    actorName: text('actor_name'),
    body: text('body'),
    action: text('action'),
    subject: text('subject'),
    fromText: text('from_text'),
    toText: text('to_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('issue_activity_kind_check', sql`${t.kind} IN ('comment', 'activity')`),
    // Exactly one owner: an issue row or an initiative row, never both or neither.
    check(
      'issue_activity_owner_check',
      sql`(${t.issueId} IS NOT NULL) <> (${t.initiativeId} IS NOT NULL)`,
    ),
    index('issue_activity_issue_idx').on(t.issueId, t.createdAt.desc(), t.id.desc()),
    index('issue_activity_initiative_idx').on(t.initiativeId, t.createdAt.desc(), t.id.desc()),
  ],
);

// Saved views (the tabs above a project's work items view). filters and display are jsonb
// blobs owned by the UI; the server stores and returns them without inspecting
// them. position orders the tabs.
export const projectView = pgTable(
  'project_view',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    filters: jsonb('filters').notNull().default({}),
    display: jsonb('display').notNull().default({}),
    position: doublePrecision('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_view_project_idx').on(t.projectId, t.position)],
);

// Saved dashboards (the analytics tabs of a project). layout is a jsonb blob
// owned by the UI: an ordered list of widget entries, each carrying its type,
// width, title, and widget-specific config. The server stores and returns it
// without inspecting it. position orders the tabs.
export const projectDashboard = pgTable(
  'project_dashboard',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    layout: jsonb('layout').notNull().default([]),
    position: doublePrecision('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_dashboard_project_idx').on(t.projectId, t.position)],
);

// Manual actions: saved macros on a project. condition is a filter set deciding
// which issues the action applies to (empty = always); effect is a partial
// issue patch applied in one update. Both jsonb blobs are owned by the UI.
export const projectAction = pgTable(
  'project_action',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Icon key for the action, resolved to a lucide icon by the UI (empty = default).
    icon: text('icon').notNull().default(''),
    condition: jsonb('condition').notNull().default({}),
    effect: jsonb('effect').notNull().default({}),
    position: doublePrecision('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_action_project_idx').on(t.projectId, t.position)],
);

// Outgoing webhook subscription. On a subscribed event the API posts the event
// payload to `url`, signed with `secret` (HMAC-SHA256). `events` is the list of
// event types this subscription wants (e.g. "issue.created"); `is_active` gates
// delivery without deleting the row. Delivery itself is handled separately.
export const webhook = pgTable(
  'webhook',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: jsonb('events').notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    // Count of consecutive failed deliveries. Reset to 0 on a successful delivery.
    // When it crosses the worker's threshold the webhook is auto-disabled
    // (is_active set false) so one dead endpoint cannot occupy the worker.
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('webhook_project_idx').on(t.projectId)],
);

// Delivery queue (transactional outbox) for webhooks. One row per (event ×
// subscribed webhook), inserted in the same transaction as the domain change so
// it is atomic with it. The worker claims due rows, posts the payload to the
// webhook, and records the outcome. event_id is stable across retries so the
// receiver can deduplicate. status: pending | success | failed.
export const webhookDelivery = pgTable(
  'webhook_delivery',
  {
    id: serial('id').primaryKey(),
    webhookId: integer('webhook_id')
      .notNull()
      .references(() => webhook.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    // Response from the last delivery attempt, for the delivery history view.
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Backs the worker's claim query: due pending rows ordered by next_attempt_at.
    index('webhook_delivery_due_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
    index('webhook_delivery_webhook_idx').on(t.webhookId),
  ],
);

// Per-user inbox notifications. One row per (recipient, event): a user is notified
// about an issue they are involved in (assigned to them, mentioned, or a participant
// on a comment/status change). The actor's own actions never notify the actor.
// project_id is denormalized from the issue so the inbox can filter and scope by
// project. source_activity_id points at the issue_activity row that produced the
// notification (set null if that entry is later removed). type selects the kind.
// read_at NULL means unread; snoozed_until, when set and still in the future, hides
// the row from the default inbox until then.
export const notification = pgTable(
  'notification',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    issueId: integer('issue_id')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    sourceActivityId: integer('source_activity_id').references(() => issueActivity.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    actorName: text('actor_name'),
    readAt: timestamp('read_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'notification_type_check',
      sql`${t.type} IN ('assigned', 'mentioned', 'commented', 'state_changed')`,
    ),
    // Backs the inbox list: a user's notifications newest first.
    index('notification_user_idx').on(t.userId, t.createdAt.desc(), t.id.desc()),
    // Backs the unread count and the unread-only inbox view.
    index('notification_user_unread_idx')
      .on(t.userId, t.id.desc())
      .where(sql`${t.readAt} IS NULL`),
  ],
);
