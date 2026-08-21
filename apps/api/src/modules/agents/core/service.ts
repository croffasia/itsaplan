import {
  db,
  aiAgent,
  user,
  apikey,
  projectMember,
  projectRole,
  agentSkillLink,
  agentToolLink,
  agentFieldTrigger,
  integrationCredential,
} from '@repo/db';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { iso, HttpError, rethrowDuplicate } from '#shared/lib';
import { getCredentialById } from '../integrations/service';
import { integrationKind } from '../integrations/catalog';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import { normalizeToolKeys, ALWAYS_ON_ACTIONS } from './runtime/tools/catalog';
import { deleteThreadsWhere } from './runtime/memory';
import { listAgentMemberFieldIds } from '#modules/custom-fields/service';

// Data access for AI agents. Each agent is backed by a hidden bot user
// (ai_agent.user_id -> user.id): that user is what a work item is assigned to,
// what authors comments/activity, and what owns the agent's better-auth API key
// (apikey.reference_id).
//
// Both kinds of agent act through the same API under the same authorization. Each
// owns an API key and a project_member row carrying a project role, so its requests
// are checked by the normal permission matrix. The kinds differ in who drives them:
// an external agent is driven over HTTP by its operator, who holds the key; an
// internal agent is driven by the built-in runtime, carries a model configuration,
// and replays its own key against the routes in process. That is why an internal
// agent's key is also kept here, encrypted — better-auth only stores a hash, and the
// runtime needs the secret on every tool call. An internal agent's effective rights
// are the intersection of its granted actions (ai_agent.tools) and its role.

export type AgentKind = 'external' | 'internal';

// Which runs an external agent's runner is served. 'project', the default: any
// member's runs, so an agent added to a project works for the whole team. 'owner':
// only runs triggered by the member who created it, for a runner whose machine and
// credentials should serve nobody else.
export type RunnerScope = 'owner' | 'project';

// One member custom field an agent reacts to, with the seconds its run waits before
// the agent may pick it up.
export interface FieldTrigger {
  fieldId: number;
  delaySec: number;
}

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
  // Run triggers.
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  // The member custom fields the agent also reacts to: being set into one of them
  // starts a run the way being made an issue's delegate does. Each field carries its
  // own delay, so a field can start at once while another leaves time to edit.
  fieldTriggers: FieldTrigger[];
  // How long a delegation run waits before it can be claimed.
  delegationDelaySec: number;
  // The project_role the bot user acts under. NULL falls back to the project's
  // default member permissions.
  roleId: number | null;
  // The member who created the agent, and whose runs an 'owner'-scoped runner is
  // limited to. 'project' scope lets the runner take any member's runs.
  ownerUserId: string | null;
  runnerScope: RunnerScope;
  // When a runner last polled for this agent, which is what presence is derived
  // from. Null until a runner connects.
  lastSeenAt: string | null;
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
  fieldTriggers: FieldTrigger[];
  delegationDelaySec: number;
  roleId: number | null;
  ownerUserId: string | null;
  runnerScope: string;
  lastSeenAt: Date | null;
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
    fieldTriggers: row.fieldTriggers,
    delegationDelaySec: row.delegationDelaySec,
    roleId: row.roleId,
    ownerUserId: row.ownerUserId,
    runnerScope: row.runnerScope as RunnerScope,
    lastSeenAt: row.lastSeenAt ? iso(row.lastSeenAt) : null,
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
  fieldTriggers: sql<
    FieldTrigger[]
  >`(select coalesce(json_agg(json_build_object('fieldId', ${agentFieldTrigger.fieldId}, 'delaySec', ${agentFieldTrigger.delaySec}) order by ${agentFieldTrigger.fieldId}), '[]'::json) from ${agentFieldTrigger} where ${agentFieldTrigger.agentId} = ${aiAgent.id})`,
  delegationDelaySec: aiAgent.delegationDelaySec,
  roleId: aiAgent.roleId,
  ownerUserId: aiAgent.ownerUserId,
  runnerScope: aiAgent.runnerScope,
  lastSeenAt: aiAgent.lastSeenAt,
  createdAt: aiAgent.createdAt,
  apiKeyStart: apikey.start,
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
    .leftJoin(apikey, eq(apikey.referenceId, aiAgent.userId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, aiAgent.modelCredentialId))
    .where(eq(aiAgent.projectId, projectId))
    .orderBy(user.name);
  return rows.map(mapAgent);
}

// Scoped to projectId so an id from another project resolves to null.
export async function getAgentById(id: number, projectId: number): Promise<AiAgentRow | null> {
  const rows = await db
    .select(agentColumns)
    .from(aiAgent)
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .leftJoin(apikey, eq(apikey.referenceId, aiAgent.userId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, aiAgent.modelCredentialId))
    .where(and(eq(aiAgent.id, id), eq(aiAgent.projectId, projectId)));
  return rows[0] ? mapAgent(rows[0]) : null;
}

// An agent may run for whoever triggered it: always an internal agent, which runs on
// our side, and an external one only when its runner is project-scoped or the trigger
// came from the agent's owner, whose machine that runner is. An 'owner'-scoped agent
// without an owner names nobody to restrict it to — the account was deleted — so it
// takes any member's runs rather than silently stopping.
export function isTriggerableBy(
  agent: { kind: string; runnerScope: string; ownerUserId: string | null },
  actorUserId: string | null,
): boolean {
  if (agent.kind === 'internal' || agent.runnerScope !== 'owner' || !agent.ownerUserId) return true;
  return agent.ownerUserId === actorUserId;
}

const triggerScopeColumns = {
  kind: aiAgent.kind,
  runnerScope: aiAgent.runnerScope,
  ownerUserId: aiAgent.ownerUserId,
};

// Whether the member may send the agent a task, for the paths that queue a run
// outside the mention and delegation triggers (a schedule). An agent that no longer
// exists reads as triggerable — the caller's own lookup reports it missing.
export async function canTriggerAgent(agentId: number, actorUserId: string): Promise<boolean> {
  const rows = await db
    .select(triggerScopeColumns)
    .from(aiAgent)
    .where(eq(aiAgent.id, agentId))
    .limit(1);
  return !rows[0] || isTriggerableBy(rows[0], actorUserId);
}

// Agents in the project whose bot user is among the given ids and that react to
// mentions. Turns the user ids parsed from a comment's mentions into the agents that
// should run for the comment's author.
export async function listMentionTriggerAgents(
  projectId: number,
  userIds: string[],
  actorUserId: string | null,
): Promise<{ id: number; userId: string }[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: aiAgent.id, userId: aiAgent.userId, ...triggerScopeColumns })
    .from(aiAgent)
    .where(
      and(
        eq(aiAgent.projectId, projectId),
        eq(aiAgent.triggerOnMention, true),
        inArray(aiAgent.userId, userIds),
      ),
    );
  return rows
    .filter((row) => isTriggerableBy(row, actorUserId))
    .map((row) => ({ id: row.id, userId: row.userId }));
}

// The agent whose bot user is userId and that reacts to being delegated to, or null.
// Turns a new delegate into the agent that should run on delegation.
export async function getAssignTriggerAgent(
  userId: string,
  actorUserId: string | null,
): Promise<{ id: number; delegationDelaySec: number } | null> {
  const rows = await db
    .select({
      id: aiAgent.id,
      delegationDelaySec: aiAgent.delegationDelaySec,
      ...triggerScopeColumns,
    })
    .from(aiAgent)
    .where(and(eq(aiAgent.userId, userId), eq(aiAgent.triggerOnAssign, true)))
    .limit(1);
  const row = rows[0];
  if (!row || !isTriggerableBy(row, actorUserId)) return null;
  return { id: row.id, delegationDelaySec: row.delegationDelaySec };
}

// The agent whose bot user is userId and that reacts to being set into that member
// field, or null. The counterpart of getAssignTriggerAgent for a custom field.
export async function getFieldTriggerAgent(
  userId: string,
  fieldId: number,
  actorUserId: string | null,
): Promise<{ id: number; delaySec: number } | null> {
  const rows = await db
    .select({
      id: aiAgent.id,
      delaySec: agentFieldTrigger.delaySec,
      ...triggerScopeColumns,
    })
    .from(aiAgent)
    .innerJoin(agentFieldTrigger, eq(agentFieldTrigger.agentId, aiAgent.id))
    .where(and(eq(aiAgent.userId, userId), eq(agentFieldTrigger.fieldId, fieldId)))
    .limit(1);
  const row = rows[0];
  if (!row || !isTriggerableBy(row, actorUserId)) return null;
  return { id: row.id, delaySec: row.delaySec };
}

// Replaces the member fields an agent reacts to. A field that no member field of the
// project holds agents for is dropped, so a stale id from a client never links.
async function setFieldTriggers(
  agentId: number,
  projectId: number,
  triggers: FieldTrigger[],
): Promise<void> {
  const allowed = new Set(await listAgentMemberFieldIds(projectId));
  const byField = new Map(
    triggers.filter((t) => allowed.has(t.fieldId)).map((t) => [t.fieldId, t.delaySec]),
  );
  await db.transaction(async (tx) => {
    await tx.delete(agentFieldTrigger).where(eq(agentFieldTrigger.agentId, agentId));
    if (byField.size > 0) {
      await tx
        .insert(agentFieldTrigger)
        .values([...byField].map(([fieldId, delaySec]) => ({ agentId, fieldId, delaySec })));
    }
  });
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
  if (integrationKind(credential.integrationKey) !== 'llm') {
    throw new HttpError(
      400,
      `A model needs an LLM provider credential, not ${credential.integrationKey}.`,
    );
  }
}

// The role an external agent acts under. It is always an explicit role of the
// project — the operator drives it over HTTP, so what it may do has to be visible on
// the Roles page rather than resolved from a built-in default. A role from another
// project is rejected; no role given means the project's default one ("Member").
async function resolveExternalRoleId(
  projectId: number,
  roleId: number | null | undefined,
): Promise<number> {
  if (roleId != null) {
    const rows = await db
      .select({ id: projectRole.id })
      .from(projectRole)
      .where(and(eq(projectRole.id, roleId), eq(projectRole.projectId, projectId)))
      .limit(1);
    if (!rows[0]) throw new HttpError(400, 'Role not found in this project');
    return rows[0].id;
  }
  const rows = await db
    .select({ id: projectRole.id })
    .from(projectRole)
    .where(and(eq(projectRole.projectId, projectId), eq(projectRole.isDefault, true)))
    .limit(1);
  if (!rows[0]) throw new HttpError(400, 'This project has no default role');
  return rows[0].id;
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
  // Run triggers. Assign is off by default, and so is mention for an external agent:
  // nothing answers its runs until its operator starts a runner, so an agent added
  // for its API key alone must not collect runs no one drains.
  triggerOnMention?: boolean;
  triggerOnAssign?: boolean;
  // The member custom fields that start a run when the agent is set into one.
  fieldTriggers?: FieldTrigger[];
  delegationDelaySec?: number;
  // Authorization role. Required in effect for an external agent: left out, it
  // resolves to the project's default role.
  roleId?: number | null;
  // External-agent runner scope (default: any member's runs).
  runnerScope?: RunnerScope;
  // The member creating the agent, who owns its runner.
  ownerUserId?: string | null;
}

// A handle addresses one person or one agent, never several: a mention is resolved
// against the members and the agents of the project at once, and by the lowercased
// handle, so a name a member already answers to cannot be issued to an agent and two
// agents of a project cannot differ by case alone. The agents of a project are held
// to that by the unique index on (project_id, lower(username)); the check here turns
// a conflict into a message that names which side took the handle. The reverse check
// sits in @repo/auth, where a member's username is set.
async function assertUsernameFree(
  projectId: number,
  username: string,
  exceptAgentId?: number,
): Promise<void> {
  const handle = username.toLowerCase();
  if ((await db.$count(user, eq(user.username, handle))) > 0)
    throw new HttpError(409, 'A member already uses this username');
  const conflicts = and(
    eq(aiAgent.projectId, projectId),
    eq(sql`lower(${aiAgent.username})`, handle),
    exceptAgentId == null ? undefined : ne(aiAgent.id, exceptAgentId),
  );
  if ((await db.$count(aiAgent, conflicts)) > 0)
    throw new HttpError(409, 'An agent with this username already exists');
}

// Issues a fresh API key owned by the agent's bot user and returns its plaintext
// value (only available at creation). The server-side call sets the owner via
// userId — better-auth allows this only for a direct (non-request) server call.
async function issueKey(userId: string, name: string): Promise<string> {
  const created = await auth.api.createApiKey({ body: { userId, name: `agent:${name}` } });
  return created.key;
}

// Creates an agent: a bot user, the ai_agent config row, its project membership, and
// its first API key. Internal-agent config fields are stored only for kind
// "internal"; an external agent keeps them null.
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
  await assertUsernameFree(projectId, input.username);
  if (isInternal) await assertModelCredential(projectId, input.modelCredentialId);

  // Every agent acts under a project role and so needs a project_member row for the
  // permission checks to apply to its requests. An external agent always carries an
  // explicit role of the project; an internal one may leave it NULL and fall back to
  // the built-in default member permissions.
  const roleId = isInternal
    ? (input.roleId ?? null)
    : await resolveExternalRoleId(projectId, input.roleId);

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
          instructions: input.instructions ?? null,
          tools: isInternal ? normalizeToolKeys(input.tools) : [],
          temperature: isInternal ? (input.temperature ?? null) : null,
          maxSteps: isInternal ? (input.maxSteps ?? null) : null,
          memoryEnabled: isInternal ? (input.memoryEnabled ?? false) : false,
          memoryLastMessages: isInternal ? (input.memoryLastMessages ?? null) : null,
          triggerOnMention: input.triggerOnMention ?? isInternal,
          triggerOnAssign: input.triggerOnAssign ?? false,
          delegationDelaySec: input.delegationDelaySec,
          roleId,
          ownerUserId: input.ownerUserId ?? null,
          runnerScope: input.runnerScope ?? 'project',
        })
        .returning({ id: aiAgent.id });
      await tx.insert(projectMember).values({ projectId, userId, role: 'member', roleId });
      return row.id;
    } catch (err) {
      rethrowDuplicate(err, 'An agent with this username');
      throw err;
    }
  });

  if (input.fieldTriggers?.length) {
    await setFieldTriggers(agentId, projectId, input.fieldTriggers);
  }

  // Issued outside the transaction: better-auth writes the key through its own
  // connection, so it cannot join this one.
  const apiKey = await issueKey(userId, input.name);
  if (isInternal) await storeAgentKey(agentId, apiKey);
  const agent = (await getAgentById(agentId, projectId))!;
  return { agent, apiKey: isInternal ? null : apiKey };
}

// Saves an internal agent's key secret, encrypted at rest, so its runtime can replay
// it on every tool call.
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

// The API key an internal agent authenticates its own tool calls with, provisioning
// one if it has none. Agents created before the key was introduced have no stored
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
    // Clears any key row left without a stored secret, so the bot user ends with
    // exactly the one issued here.
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
  fieldTriggers?: FieldTrigger[];
  delegationDelaySec?: number;
  roleId?: number | null;
  runnerScope?: RunnerScope;
}

export async function updateAgent(
  id: number,
  projectId: number,
  patch: AgentPatch,
  // The member making the change: choosing the 'owner' scope means their own runs.
  actorUserId: string,
): Promise<AiAgentRow | null> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return null;
  await assertModelCredential(projectId, patch.modelCredentialId);

  // The display name lives on the bot user.
  if (patch.name !== undefined) {
    await db.update(user).set({ name: patch.name }).where(eq(user.id, agent.userId));
  }

  // Changing an agent's role updates both the config row and the bot user's
  // membership, so the permission checks act under the new role. An external agent
  // cannot end up without one: clearing it falls back to the project's default role.
  const roleId =
    patch.roleId !== undefined && agent.kind === 'external'
      ? await resolveExternalRoleId(projectId, patch.roleId)
      : patch.roleId;
  if (roleId !== undefined) {
    await db
      .update(projectMember)
      .set({ roleId })
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, agent.userId)));
  }

  const set: Partial<typeof aiAgent.$inferInsert> = {};
  if (patch.username !== undefined) {
    await assertUsernameFree(projectId, patch.username, id);
    set.username = patch.username;
  }
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
  if (patch.delegationDelaySec !== undefined) set.delegationDelaySec = patch.delegationDelaySec;
  if (roleId !== undefined) set.roleId = roleId;
  // The scope and its owner are one setting: 'owner' means the runs of the member who
  // chose it, so switching to it hands the agent to them.
  if (patch.runnerScope !== undefined) {
    set.runnerScope = patch.runnerScope;
    if (patch.runnerScope === 'owner') set.ownerUserId = actorUserId;
  }
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
  if (patch.fieldTriggers !== undefined) {
    await setFieldTriggers(id, projectId, patch.fieldTriggers);
  }

  return getAgentById(id, projectId);
}

// Replaces the agent's API key: deletes the current key row(s) for the bot user
// and issues a new one. Returns the new plaintext secret, or null if the agent
// does not exist. There is no atomic rotate in the plugin, so this is delete+create.
// An internal agent's new secret is re-encrypted onto its row for its runtime.
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
  await deleteThreadsWhere({ agentId: id });
  await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
  await db.delete(user).where(eq(user.id, agent.userId));
  return true;
}

// True if the agent belongs to the project (guards addressing an agent by id).
export async function agentInProject(agentId: number, projectId: number): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(and(eq(aiAgent.id, agentId), eq(aiAgent.projectId, projectId)))
    .limit(1);
  return rows.length > 0;
}
