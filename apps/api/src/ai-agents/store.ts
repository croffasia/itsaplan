import {
  db,
  aiAgent,
  user,
  apikey,
  projectMember,
  agentSkillLink,
  agentToolLink,
  integrationCredential,
} from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { iso, rethrowDuplicate } from '../shared/lib';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import { normalizeToolKeys, ALWAYS_ON_ACTIONS } from './runtime/tools/catalog';

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
  roleId?: number | null;
}

export async function updateAgent(
  id: number,
  projectId: number,
  patch: AgentPatch,
): Promise<AiAgentRow | null> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return null;

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
// An internal agent's new secret is re-encrypted onto its row for its runtime.
export async function regenerateKey(id: number, projectId: number): Promise<string | null> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return null;
  await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
  const apiKey = await issueKey(agent.userId, agent.name);
  if (agent.kind === 'internal') await storeAgentKey(agent.id, apiKey);
  return apiKey;
}

// Deletes an agent: its API key row(s), then the bot user. Deleting the user
// cascades to the ai_agent row (ON DELETE CASCADE on user_id), sets assignee_user_id
// to NULL on every issue the agent was on, and nulls the actor on its activity.
export async function deleteAgent(id: number, projectId: number): Promise<boolean> {
  const agent = await getAgentById(id, projectId);
  if (!agent) return false;
  await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
  await db.delete(user).where(eq(user.id, agent.userId));
  return true;
}
