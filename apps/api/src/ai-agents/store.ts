import {
  db,
  aiAgent,
  user,
  apikey,
  projectMember,
  agentSkillLink,
  agentToolLink,
  agentRun,
  agentSchedule,
  mcpAuditLog,
  integrationCredential,
  hermesConversation,
} from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { iso, HttpError, rethrowDuplicate } from '../shared/lib';
import { getCredentialById } from '../integrations/store';
import { isLlmIntegration } from '../integrations/catalog';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import { normalizeToolKeys, ALWAYS_ON_ACTIONS } from './runtime/tools/catalog';
import { deleteThreadsWhere } from './runtime/memory';

// Data access for AI agents. Each agent is backed by a hidden bot user
// (ai_agent.user_id -> user.id): that user is what a work item is assigned to,
// what authors comments/activity, and what owns the agent's better-auth API key
// (apikey.reference_id).
//
// Both kinds act through the same API under a project role. External agents are
// driven by their operator. Internal agents use the built-in model runtime.
export type AgentKind = 'external' | 'internal';

export interface AiAgentRow {
  id: number;
  projectId: number;
  userId: string;
  // name lives on the bot user; username is the project-scoped handle.
  name: string;
  username: string;
  kind: AgentKind;
  modelCredentialId: number | null;
  model: string | null;
  instructions: string | null;
  tools: string[];
  temperature: number | null;
  maxSteps: number | null;
  // Conversation memory: recall the last memoryLastMessages messages of a thread.
  memoryEnabled: boolean;
  memoryLastMessages: number | null;
  // Internal-agent run triggers.
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  // The project_role the bot user acts under. NULL falls back to the project's
  // default member permissions.
  roleId: number | null;
  createdAt: string;
  // The agent's current API key, for display only — the secret is never returned
  // after creation. start is the key's leading characters kept for identification.
  apiKeyStart: string | null;
  // The integration key of the model credential (the provider, e.g. "openai"), or
  // null when no credential is set. For the list's meta display.
  modelProvider: string | null;
  // How many actions the agent can take, how many skills and configured tools are
  // enabled. actionCount is the always-on read-only actions plus the granted mutating
  // ones (`tools`), matching the Actions section of the editor. For the meta display.
  actionCount: number;
  skillCount: number;
  toolCount: number;
}

function mapAgent(row: {
  id: number;
  projectId: number;
  userId: string;
  name: string;
  username: string;
  kind: string;
  modelCredentialId: number | null;
  model: string | null;
  instructions: string | null;
  tools: unknown;
  temperature: number | null;
  maxSteps: number | null;
  memoryEnabled: boolean;
  memoryLastMessages: number | null;
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  roleId: number | null;
  createdAt: Date;
  apiKeyStart: string | null;
  modelProvider: string | null;
  skillCount: number;
  toolCount: number;
}): AiAgentRow {
  const tools = Array.isArray(row.tools) ? (row.tools as string[]) : [];
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    name: row.name,
    username: row.username,
    kind: row.kind as AgentKind,
    modelCredentialId: row.modelCredentialId,
    model: row.model,
    instructions: row.instructions,
    tools,
    temperature: row.temperature,
    maxSteps: row.maxSteps,
    memoryEnabled: row.memoryEnabled,
    memoryLastMessages: row.memoryLastMessages,
    triggerOnMention: row.triggerOnMention,
    triggerOnAssign: row.triggerOnAssign,
    roleId: row.roleId,
    createdAt: iso(row.createdAt),
    apiKeyStart: row.apiKeyStart,
    modelProvider: row.modelProvider,
    actionCount: tools.length + ALWAYS_ON_ACTIONS.length,
    skillCount: row.skillCount,
    toolCount: row.toolCount,
  };
}

const agentColumns = {
  id: aiAgent.id,
  projectId: aiAgent.projectId,
  userId: aiAgent.userId,
  name: user.name,
  username: aiAgent.username,
  kind: aiAgent.kind,
  modelCredentialId: aiAgent.modelCredentialId,
  model: aiAgent.model,
  instructions: aiAgent.instructions,
  tools: aiAgent.tools,
  temperature: aiAgent.temperature,
  maxSteps: aiAgent.maxSteps,
  memoryEnabled: aiAgent.memoryEnabled,
  memoryLastMessages: aiAgent.memoryLastMessages,
  triggerOnMention: aiAgent.triggerOnMention,
  triggerOnAssign: aiAgent.triggerOnAssign,
  roleId: aiAgent.roleId,
  createdAt: aiAgent.createdAt,
  apiKeyStart: sql<string | null>`(
    select ${apikey.start}
    from ${apikey}
    where ${apikey.referenceId} = ${aiAgent.userId}
    order by ${apikey.createdAt} asc
    limit 1
  )`,
  modelProvider: integrationCredential.integrationKey,
  skillCount:
    sql<number>`(select count(*) from ${agentSkillLink} where ${agentSkillLink.agentId} = ${aiAgent.id})`.mapWith(
      Number,
    ),
  toolCount:
    sql<number>`(select count(*) from ${agentToolLink} where ${agentToolLink.agentId} = ${aiAgent.id})`.mapWith(
      Number,
    ),
};

export async function listAgents(projectId: number): Promise<AiAgentRow[]> {
  const rows = await db
    .select(agentColumns)
    .from(aiAgent)
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, aiAgent.modelCredentialId))
    .where(eq(aiAgent.projectId, projectId))
    .orderBy(user.name);
  return rows.map(mapAgent);
}

export interface AgentFleetSummary {
  generatedAt: string;
  timezone: string;
  status: {
    live: number;
    idle: number;
    warning: number;
  };
  runs24h: number;
  runTrendPercent: number | null;
  schedules: {
    active: number;
    total: number;
  };
  successRate7d: number | null;
  p95DurationMs7d: number | null;
  peak: {
    runs: number;
    hour: string;
  };
  hourlyRuns: {
    hour: string;
    runs: number;
  }[];
}

export async function getAgentFleetSummary(
  projectId: number,
  timezone: string,
): Promise<AgentFleetSummary> {
  const [statusRows, metricRows, scheduleRows, hourlyRows] = await Promise.all([
    db
      .select({
        live: sql<boolean>`exists (
          select 1 from ${agentRun} r
          where r.agent_id = ${aiAgent.id}
            and r.status = 'pending'
            and r.started_at is not null
            and r.finished_at is null
            and r.last_error is null
            and r.next_attempt_at > now()
        )`,
        latestStatus: sql<string | null>`(
          select r.status from ${agentRun} r
          where r.agent_id = ${aiAgent.id}
          order by r.id desc limit 1
        )`,
      })
      .from(aiAgent)
      .where(eq(aiAgent.projectId, projectId)),
    db.execute(sql`
      with activity as (
        select
          r.created_at,
          r.status,
          extract(epoch from (r.finished_at - r.started_at)) * 1000 as duration_ms
        from ${agentRun} r
        inner join ${aiAgent} a on a.id = r.agent_id
        where a.project_id = ${projectId}
        union all
        select
          m.created_at,
          m.result_status as status,
          m.duration_ms::numeric as duration_ms
        from ${mcpAuditLog} m
        where m.project_id = ${projectId}
          and m.actor = 'bob-agent'
      )
      select
        (count(*) filter (where created_at >= now() - interval '24 hours'))::int as "runs24h",
        (count(*) filter (
          where created_at >= now() - interval '48 hours'
            and created_at < now() - interval '24 hours'
        ))::int as "previousRuns24h",
        (count(*) filter (
          where created_at >= now() - interval '7 days' and status = 'success'
        ))::int as "success7d",
        (count(*) filter (
          where created_at >= now() - interval '7 days'
            and status in ('success', 'failed', 'error', 'denied')
        ))::int as "finished7d",
        percentile_cont(0.95) within group (order by duration_ms) filter (
          where created_at >= now() - interval '7 days' and duration_ms is not null
        ) as "p95DurationMs7d"
      from activity
    `),
    db
      .select({
        active: sql<number>`(count(*) filter (where ${agentSchedule.status} = 'active'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(agentSchedule)
      .innerJoin(aiAgent, eq(aiAgent.id, agentSchedule.agentId))
      .where(eq(aiAgent.projectId, projectId)),
    db.execute(sql`
      with hours as (
        select generate_series(
          date_trunc('hour', now()) - interval '23 hours',
          date_trunc('hour', now()),
          interval '1 hour'
        ) as bucket
      ), project_activity as (
        select r.id::text as id, r.created_at
        from ${agentRun} r
        inner join ${aiAgent} a on a.id = r.agent_id
        where a.project_id = ${projectId}
          and r.created_at >= date_trunc('hour', now()) - interval '23 hours'
        union all
        select m.id::text as id, m.created_at
        from ${mcpAuditLog} m
        where m.project_id = ${projectId}
          and m.actor = 'bob-agent'
          and m.created_at >= date_trunc('hour', now()) - interval '23 hours'
      )
      select h.bucket::text as hour, count(a.id)::int as runs
      from hours h
      left join project_activity a
        on a.created_at >= h.bucket and a.created_at < h.bucket + interval '1 hour'
      group by h.bucket
      order by h.bucket
    `),
  ]);

  const live = statusRows.filter((row) => row.live).length;
  const warning = statusRows.filter((row) => !row.live && row.latestStatus === 'failed').length;
  const metrics = (
    metricRows as unknown as {
      runs24h: number;
      previousRuns24h: number;
      success7d: number;
      finished7d: number;
      p95DurationMs7d: number | null;
    }[]
  )[0] ?? {
    runs24h: 0,
    previousRuns24h: 0,
    success7d: 0,
    finished7d: 0,
    p95DurationMs7d: null,
  };
  const hourlyRuns = (hourlyRows as unknown as { hour: string; runs: number }[]).map((row) => ({
    hour: new Date(row.hour).toISOString(),
    runs: Number(row.runs),
  }));
  const peak = hourlyRuns.reduce(
    (current, row) => (row.runs > current.runs ? row : current),
    hourlyRuns[0] ?? { hour: new Date().toISOString(), runs: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    timezone,
    status: {
      live,
      idle: statusRows.length - live - warning,
      warning,
    },
    runs24h: metrics.runs24h,
    runTrendPercent:
      metrics.previousRuns24h > 0
        ? Math.round(((metrics.runs24h - metrics.previousRuns24h) / metrics.previousRuns24h) * 100)
        : null,
    schedules: scheduleRows[0] ?? { active: 0, total: 0 },
    successRate7d:
      metrics.finished7d > 0
        ? Math.round((metrics.success7d / metrics.finished7d) * 1000) / 10
        : null,
    p95DurationMs7d:
      metrics.p95DurationMs7d == null ? null : Math.round(Number(metrics.p95DurationMs7d)),
    peak,
    hourlyRuns,
  };
}

// Scoped to projectId so an id from another project resolves to null.
export async function getAgentById(id: number, projectId: number): Promise<AiAgentRow | null> {
  const rows = await db
    .select(agentColumns)
    .from(aiAgent)
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, aiAgent.modelCredentialId))
    .where(and(eq(aiAgent.id, id), eq(aiAgent.projectId, projectId)));
  return rows[0] ? mapAgent(rows[0]) : null;
}

// Internal agents in the project whose bot user is among the given ids and that
// react to mentions. Turns the user ids parsed from a comment's mentions into the
// agents that should run.
export async function listInternalAgentsByUserIds(
  projectId: number,
  userIds: string[],
): Promise<{ id: number; userId: string }[]> {
  if (userIds.length === 0) return [];
  return db
    .select({ id: aiAgent.id, userId: aiAgent.userId })
    .from(aiAgent)
    .where(
      and(
        eq(aiAgent.projectId, projectId),
        eq(aiAgent.kind, 'internal'),
        eq(aiAgent.triggerOnMention, true),
        inArray(aiAgent.userId, userIds),
      ),
    );
}

// The internal agent whose bot user is userId and that reacts to being delegated to,
// or null. Turns a new delegate into the agent that should run on delegation.
export async function getAssignTriggerAgent(userId: string): Promise<{ id: number } | null> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(
      and(
        eq(aiAgent.userId, userId),
        eq(aiAgent.kind, 'internal'),
        eq(aiAgent.triggerOnAssign, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// True if the user id is the bot user of an agent in this project. Validates that a
// delegate is an agent of the same project before it is written to an issue.
export async function isProjectAgent(projectId: number, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(and(eq(aiAgent.projectId, projectId), eq(aiAgent.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// True if the user id is an agent's bot user (in any project). A comment authored by
// such a user never triggers agent runs, which stops agent-to-agent mention loops.
export async function isAgentUser(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(eq(aiAgent.userId, userId))
    .limit(1);
  return rows.length > 0;
}

// An unknown, foreign, or non-LLM credential id would otherwise be stored and only
// surface later, as a run that fails to start.
async function assertModelCredential(
  projectId: number,
  credentialId: number | null | undefined,
): Promise<void> {
  if (credentialId == null) return;
  const credential = await getCredentialById(credentialId, projectId);
  if (!credential) throw new HttpError(400, 'Credential not found');
  if (!isLlmIntegration(credential.integrationKey)) {
    throw new HttpError(
      400,
      `A model needs an LLM provider credential, not ${credential.integrationKey}.`,
    );
  }
}

export interface NewAgentInput {
  name: string;
  username: string;
  kind: AgentKind;
  modelCredentialId?: number | null;
  model?: string | null;
  instructions?: string | null;
  tools?: string[];
  temperature?: number | null;
  maxSteps?: number | null;
  memoryEnabled?: boolean;
  memoryLastMessages?: number | null;
  // Internal-agent triggers (defaults: mention on, assign off).
  triggerOnMention?: boolean;
  triggerOnAssign?: boolean;
  // External-agent authorization role.
  roleId?: number | null;
}

// Issues a fresh API key owned by the agent's bot user and returns its plaintext
// value (only available at creation). The server-side call sets the owner via
// userId — better-auth allows this only for a direct (non-request) server call.
async function issueKey(userId: string, name: string): Promise<string> {
  const created = await auth.api.createApiKey({ body: { userId, name: `agent:${name}` } });
  return created.key;
}

// Creates an agent: a bot user, the ai_agent config row, its project membership, and
// its first API key. Internal-agent configuration is stored only for internal agents.
//
// Returns the agent plus the one-time key secret. That secret is returned only for
// an external agent, whose operator must copy it — an internal agent's key is kept
// encrypted on the row for its own runtime and is never surfaced to a caller.
export async function createAgent(
  projectId: number,
  input: NewAgentInput,
): Promise<{ agent: AiAgentRow; apiKey: string | null }> {
  const userId = crypto.randomUUID();
  const email = `${userId}@agents.local`;
  const isInternal = input.kind === 'internal';
  if (isInternal) await assertModelCredential(projectId, input.modelCredentialId);

  // Every agent acts under a project role and so needs a project_member row for the
  // permission checks to apply to its requests. roleId names the role; NULL falls
  // back to the project's default member permissions.
  const roleId = input.roleId ?? null;

  const agentId = await db.transaction(async (tx) => {
    await tx
      .insert(user)
      .values({ id: userId, name: input.name, email, emailVerified: false, role: 'user' });
    try {
      const [row] = await tx
        .insert(aiAgent)
        .values({
          projectId,
          userId,
          username: input.username,
          kind: input.kind,
          modelCredentialId: isInternal ? (input.modelCredentialId ?? null) : null,
          model: isInternal ? (input.model ?? null) : null,
          instructions: isInternal ? (input.instructions ?? null) : null,
          tools: isInternal ? normalizeToolKeys(input.tools) : [],
          temperature: isInternal ? (input.temperature ?? null) : null,
          maxSteps: isInternal ? (input.maxSteps ?? null) : null,
          memoryEnabled: isInternal ? (input.memoryEnabled ?? false) : false,
          memoryLastMessages: isInternal ? (input.memoryLastMessages ?? null) : null,
          triggerOnMention: isInternal ? (input.triggerOnMention ?? true) : false,
          triggerOnAssign: isInternal ? (input.triggerOnAssign ?? false) : false,
          roleId,
        })
        .returning({ id: aiAgent.id });
      await tx.insert(projectMember).values({ projectId, userId, role: 'member', roleId });
      return row.id;
    } catch (err) {
      rethrowDuplicate(err, 'An agent with this username');
      throw err;
    }
  });

  // Issued outside the transaction: better-auth writes the key through its own
  // connection, so it cannot join this one.
  const apiKey = await issueKey(userId, input.name);
  if (isInternal) await storeAgentKey(agentId, apiKey);
  const agent = (await getAgentById(agentId, projectId))!;
  return { agent, apiKey: isInternal ? null : apiKey };
}

// Saves the runtime key encrypted at rest so it can be replayed on tool calls.
async function storeAgentKey(agentId: number, apiKey: string): Promise<void> {
  const enc = encryptSecret(apiKey);
  await db
    .update(aiAgent)
    .set({ apiKeyCiphertext: enc.ciphertext, apiKeyIv: enc.iv, apiKeyAuthTag: enc.authTag })
    .where(eq(aiAgent.id, agentId));
}

// Namespace for the provisioning advisory lock, so its keys cannot collide with an
// advisory lock taken anywhere else. The second key is the agent id.
const KEY_PROVISION_LOCK_NS = 8241;

// Reads and decrypts an agent's stored key, or null when it has none yet.
async function readAgentKey(agentId: number): Promise<string | null> {
  const rows = await db
    .select({
      ciphertext: aiAgent.apiKeyCiphertext,
      iv: aiAgent.apiKeyIv,
      authTag: aiAgent.apiKeyAuthTag,
    })
    .from(aiAgent)
    .where(eq(aiAgent.id, agentId));
  const row = rows[0];
  if (!row?.ciphertext || !row.iv || !row.authTag) return null;
  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag });
}

// The encrypted API key an agent runtime authenticates its tool calls with,
// provisioning one if it has none. Existing external operator keys are preserved.
// Agents created before the key was introduced have no stored
// secret (and may predate the membership too), so both are filled in on first use
// rather than in a data migration — better-auth issues a key through its API, which
// a SQL migration cannot call.
//
// Provisioning is serialized per agent with an advisory lock. Runs are claimed in
// batches and across replicas (see run-queue), so two runs of the same unprovisioned
// agent can start together; without the lock each would issue a key, and the second
// would revoke the first out from under a run already using it. A second surviving
// key would be just as wrong: the agent reads join apikey on the bot user, so two
// rows would list the agent twice.
export async function getInternalAgentApiKey(agent: AiAgentRow): Promise<string> {
  const existing = await readAgentKey(agent.id);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    // Held until this transaction ends. A concurrent run blocks here and then finds
    // the key the winner stored, instead of issuing a second one.
    await tx.execute(sql`select pg_advisory_xact_lock(${KEY_PROVISION_LOCK_NS}, ${agent.id})`);
    const won = await readAgentKey(agent.id);
    if (won) return won;

    await tx
      .insert(projectMember)
      .values({
        projectId: agent.projectId,
        userId: agent.userId,
        role: 'member',
        roleId: agent.roleId,
      })
      .onConflictDoNothing();
    await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
    const apiKey = await issueKey(agent.userId, agent.name);
    await storeAgentKey(agent.id, apiKey);
    return apiKey;
  });
}

export interface AgentPatch {
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

export async function updateAgent(
  id: number,
  projectId: number,
  patch: AgentPatch,
): Promise<AiAgentRow | null> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return null;
  await assertModelCredential(projectId, patch.modelCredentialId);

  // The display name lives on the bot user.
  if (patch.name !== undefined) {
    await db.update(user).set({ name: patch.name }).where(eq(user.id, agent.userId));
  }

  // Changing an agent's role updates both the config row and the bot user's
  // membership, so the permission checks act under the new role.
  if (patch.roleId !== undefined) {
    await db
      .update(projectMember)
      .set({ roleId: patch.roleId })
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, agent.userId)));
  }

  const set: Partial<typeof aiAgent.$inferInsert> = {};
  if (patch.username !== undefined) set.username = patch.username;
  if (patch.modelCredentialId !== undefined) set.modelCredentialId = patch.modelCredentialId;
  if (patch.model !== undefined) set.model = patch.model;
  if (patch.instructions !== undefined) set.instructions = patch.instructions;
  if (patch.tools !== undefined) set.tools = normalizeToolKeys(patch.tools);
  if (patch.temperature !== undefined) set.temperature = patch.temperature;
  if (patch.maxSteps !== undefined) set.maxSteps = patch.maxSteps;
  if (patch.memoryEnabled !== undefined) set.memoryEnabled = patch.memoryEnabled;
  if (patch.memoryLastMessages !== undefined) set.memoryLastMessages = patch.memoryLastMessages;
  if (patch.triggerOnMention !== undefined) set.triggerOnMention = patch.triggerOnMention;
  if (patch.triggerOnAssign !== undefined) set.triggerOnAssign = patch.triggerOnAssign;
  if (patch.roleId !== undefined) set.roleId = patch.roleId;
  if (Object.keys(set).length > 0) {
    try {
      await db
        .update(aiAgent)
        .set(set)
        .where(and(eq(aiAgent.id, id), eq(aiAgent.projectId, projectId)));
    } catch (err) {
      rethrowDuplicate(err, 'An agent with this username');
      throw err;
    }
  }

  return getAgentById(id, projectId);
}

// Replaces the agent's API key: deletes the current key row(s) for the bot user
// and issues a new one. Returns the new plaintext secret, or null if the agent
// does not exist. There is no atomic rotate in the plugin, so this is delete+create.
// An internal agent's new secret is encrypted for its runtime.
export async function regenerateKey(id: number, projectId: number): Promise<string | null> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return null;
  await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
  const apiKey = await issueKey(agent.userId, agent.name);
  if (agent.kind === 'internal') await storeAgentKey(agent.id, apiKey);
  return apiKey;
}

// Deletes an agent: its conversation threads, its API key row(s), then the bot user.
// Deleting the user cascades to the ai_agent row (ON DELETE CASCADE on user_id), sets
// assignee_user_id to NULL on every issue the agent was on, and nulls the actor on its
// activity.
export async function deleteAgent(id: number, projectId: number): Promise<boolean> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return false;
  const [conversation] = await db
    .select({ id: hermesConversation.id })
    .from(hermesConversation)
    .where(eq(hermesConversation.agentId, id))
    .limit(1);
  if (conversation) throw new HttpError(409, 'Archive retention prevents deleting this agent');
  await deleteThreadsWhere({ agentId: id });
  await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
  await db.delete(user).where(eq(user.id, agent.userId));
  return true;
}
