import {
  db,
  aiAgent,
  user,
  apikey,
  project,
  projectColumn,
  projectMember,
  teamMember,
  agentSkillLink,
  agentToolLink,
  agentFieldTrigger,
  customField,
  integrationCredential,
} from '@repo/db';
import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { iso, HttpError, rethrowDuplicate } from '#shared/lib';
import { getCredentialById } from '../integrations/service';
import { integrationKind } from '../integrations/catalog';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import { normalizeToolKeys, ALWAYS_ON_ACTIONS } from './runtime/tools/catalog';
import { deleteThreadsWhere } from './runtime/memory';
import { listAgentMemberFieldIds } from '#modules/custom-fields/service';
import { runsTeam, type TeamStanding } from '#modules/teams/service';
import { getDefaultRoleId } from '#modules/roles/service';
import { deleteAccount } from '#shared/account-deletion';

// Data access for AI agents. Each agent is backed by a hidden bot user
// (ai_agent.user_id -> user.id): that user is what a work item is assigned to,
// what authors comments/activity, and what owns the agent's better-auth API key
// (apikey.reference_id).
//
// An agent belongs to a team and works in the projects of that team it is attached
// to; a project_member row is what says so, and one key therefore reaches every one
// of them. Both kinds of agent act through the same API under the same authorization:
// each owns an API key and project_member rows carrying its team role, so its requests
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
export type RunnerScope = 'owner' | 'team';

// One member custom field an agent reacts to, with the seconds its run waits before
// the agent may pick it up.
export interface FieldTrigger {
  fieldId: number;
  delaySec: number;
}

// The same trigger as a read of an agent returns it: the field's name comes along, so
// a reader can name the field without loading the project it belongs to.
export interface FieldTriggerRead extends FieldTrigger {
  name: string;
}

// A project the agent is a member of, as the settings screen lists them.
export interface AgentProject {
  id: number;
  key: string;
  name: string;
}

export interface AiAgentRow {
  id: number;
  teamId: number;
  userId: string;
  // The projects of the team the agent works in, by key. Membership is what grants
  // its key access to a project, so this is the list an operator edits.
  projects: AgentProject[];
  // name lives on the bot user; username is the team-scoped handle.
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
  fieldTriggers: FieldTriggerRead[];
  // How long a delegation run waits before it can be claimed.
  delegationDelaySec: number;
  // The member who created the agent, and whose runs an 'owner'-scoped runner is
  // limited to. 'team' scope lets the runner take any member's runs.
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
  teamId: number;
  projects: AgentProject[];
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
  fieldTriggers: FieldTriggerRead[];
  delegationDelaySec: number;
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
    teamId: row.teamId,
    projects: row.projects,
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
  teamId: aiAgent.teamId,
  // The projects of the agent's own team it is a member of. A membership in a project
  // of another team cannot happen (the attach route refuses it) and is not listed.
  projects: sql<
    AgentProject[]
  >`(select coalesce(json_agg(json_build_object('id', p.id, 'key', p.key, 'name', p.name) order by p.key), '[]'::json) from ${projectMember} pm join ${project} p on p.id = pm.project_id where pm.user_id = ${aiAgent.userId} and p.team_id = ${aiAgent.teamId})`,
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
    FieldTriggerRead[]
  >`(select coalesce(json_agg(json_build_object('fieldId', ${agentFieldTrigger.fieldId}, 'name', ${customField.name}, 'delaySec', ${agentFieldTrigger.delaySec}) order by ${customField.name}), '[]'::json) from ${agentFieldTrigger} join ${customField} on ${customField.id} = ${agentFieldTrigger.fieldId} where ${agentFieldTrigger.agentId} = ${aiAgent.id})`,
  delegationDelaySec: aiAgent.delegationDelaySec,
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

// The bot user carries the name, the key row the prefix, and the credential the
// provider, so every read of an agent joins the three.
function agentQuery() {
  return db
    .select(agentColumns)
    .from(aiAgent)
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .leftJoin(apikey, eq(apikey.referenceId, aiAgent.userId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, aiAgent.modelCredentialId));
}

// Whether the agent is a member of the project, as a condition on a query over
// ai_agent. Membership is held by the bot user, so it is a project_member row of it.
function inProject(projectId: number) {
  return sql`exists (select 1 from ${projectMember} pm where pm.user_id = ${aiAgent.userId} and pm.project_id = ${projectId})`;
}

// The agents a caller may reach: an owner or a manager of the team reaches every agent
// it has, anyone else only the ones working in a project they are a member of. The
// reads below take the id it returns, or nothing when the whole team is theirs.
export function agentScopeOf(membership: {
  role: TeamStanding;
  userId: string;
}): string | undefined {
  return runsTeam(membership.role) ? undefined : membership.userId;
}

// The projects of the team the user is a member of. Attaching an agent to a project
// makes its bot user a member of that one, so the set bounds where someone who does
// not run the team may put an agent.
export async function memberProjectIds(teamId: number, userId: string): Promise<number[]> {
  const rows = await db
    .select({ id: project.id })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .where(and(eq(project.teamId, teamId), eq(projectMember.userId, userId)));
  return rows.map((row) => row.id);
}

// Whether the agent works in a project the user is a member of, as a condition on a
// query over ai_agent. Both sides are project_member rows: the agent's bot user and
// the user themselves.
function sharesProjectWith(userId: string) {
  return sql`exists (select 1 from ${projectMember} pm join ${projectMember} mine on mine.project_id = pm.project_id and mine.user_id = ${userId} where pm.user_id = ${aiAgent.userId})`;
}

// The agents of the team, or only the ones working in one of its projects when
// projectId is given. visibleTo narrows the list to the agents working in a project
// that user belongs to; the callers who run the team pass nothing and see them all.
export async function listAgents(
  teamId: number,
  projectId?: number,
  visibleTo?: string,
): Promise<AiAgentRow[]> {
  const rows = await agentQuery()
    .where(
      and(
        eq(aiAgent.teamId, teamId),
        projectId == null ? undefined : inProject(projectId),
        visibleTo == null ? undefined : sharesProjectWith(visibleTo),
      ),
    )
    .orderBy(user.name);
  return rows.map(mapAgent);
}

// Scoped to teamId so an id from another team resolves to null, and to visibleTo the
// same way the list is: an agent of a project that user is not in reads as missing.
export async function getAgentById(
  id: number,
  teamId: number,
  visibleTo?: string,
): Promise<AiAgentRow | null> {
  const rows = await agentQuery().where(
    and(
      eq(aiAgent.id, id),
      eq(aiAgent.teamId, teamId),
      visibleTo == null ? undefined : sharesProjectWith(visibleTo),
    ),
  );
  return rows[0] ? mapAgent(rows[0]) : null;
}

// The agent of that id that works in the project, or null. A run addresses an agent
// together with the project it is to work in, and membership is what allows it: an
// agent detached from a project stops running there, whatever was queued for it.
export async function getAgentInProject(id: number, projectId: number): Promise<AiAgentRow | null> {
  const rows = await agentQuery().where(and(eq(aiAgent.id, id), inProject(projectId)));
  return rows[0] ? mapAgent(rows[0]) : null;
}

// An agent may run for whoever triggered it: always an internal agent, which runs on
// our side, and an external one only when its runner is team-scoped or the trigger
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

// Agents working in the project whose bot user is among the given ids and that react
// to mentions. Turns the user ids parsed from a comment's mentions into the agents that
// should run for the comment's author. An agent of the team that is not a member of
// this project is left out: a mention must not pull a key into a project the team
// never opened it to.
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
        inProject(projectId),
        eq(aiAgent.triggerOnMention, true),
        inArray(aiAgent.userId, userIds),
      ),
    );
  return rows
    .filter((row) => isTriggerableBy(row, actorUserId))
    .map((row) => ({ id: row.id, userId: row.userId }));
}

// The agent working in the project whose bot user is userId and that reacts to being
// delegated to, or null. Turns a new delegate into the agent that should run on
// delegation.
export async function getAssignTriggerAgent(
  projectId: number,
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
    .where(and(eq(aiAgent.userId, userId), eq(aiAgent.triggerOnAssign, true), inProject(projectId)))
    .limit(1);
  const row = rows[0];
  if (!row || !isTriggerableBy(row, actorUserId)) return null;
  return { id: row.id, delegationDelaySec: row.delegationDelaySec };
}

// The agent working in the project whose bot user is userId and that reacts to being
// set into that member field, or null. The counterpart of getAssignTriggerAgent for a
// custom field.
export async function getFieldTriggerAgent(
  projectId: number,
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
    .where(
      and(eq(aiAgent.userId, userId), eq(agentFieldTrigger.fieldId, fieldId), inProject(projectId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !isTriggerableBy(row, actorUserId)) return null;
  return { id: row.id, delaySec: row.delaySec };
}

// Replaces the member fields an agent reacts to. A field that is not a member field
// holding agents in one of the agent's projects is dropped, so a stale id from a
// client never links.
async function setFieldTriggers(
  agentId: number,
  projectIds: number[],
  triggers: FieldTrigger[],
): Promise<void> {
  const allowed = new Set(await listAgentMemberFieldIds(projectIds));
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

// True if the user id is the bot user of an agent working in this project. Validates
// that a delegate is an agent of the project before it is written to an issue, and is
// what keeps the delegation and field triggers off an agent that is not a member.
export async function isProjectAgent(projectId: number, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(and(eq(aiAgent.userId, userId), inProject(projectId)))
    .limit(1);
  return rows.length > 0;
}

// The team of the agent a bot user belongs to, or null when the user is a person.
// An agent belongs to exactly one team, so this is the team its API key acts in.
export async function agentTeam(userId: string): Promise<number | null> {
  const rows = await db
    .select({ teamId: aiAgent.teamId })
    .from(aiAgent)
    .where(eq(aiAgent.userId, userId))
    .limit(1);
  return rows[0]?.teamId ?? null;
}

// True if the user id is an agent's bot user rather than a person's.
export async function isAgentUser(userId: string): Promise<boolean> {
  return (await agentTeam(userId)) !== null;
}

// An unknown, foreign, or non-LLM credential id would otherwise be stored and only
// surface later, as a run that fails to start. Credentials belong to the team, so an
// id from another team is what counts as foreign.
async function assertModelCredential(
  teamId: number,
  credentialId: number | null | undefined,
): Promise<void> {
  if (credentialId == null) return;
  const credential = await getCredentialById(credentialId, teamId);
  if (!credential) throw new HttpError(400, 'Credential not found');
  if (integrationKind(credential.integrationKey) !== 'llm') {
    throw new HttpError(
      400,
      `A model needs an LLM provider credential, not ${credential.integrationKey}.`,
    );
  }
}

// The projects of the team the agent is to work in. An id that is not a project of the
// team is refused rather than dropped: attaching an agent to a project its team does
// not own would put its key somewhere the team never opened.
async function resolveTeamProjectIds(teamId: number, projectIds: number[]): Promise<number[]> {
  const wanted = [...new Set(projectIds)];
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.teamId, teamId), inArray(project.id, wanted)));
  if (rows.length !== wanted.length) throw new HttpError(400, 'Project not found in this team');
  return rows.map((row) => row.id);
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
  // The projects of the team the agent works in. Empty means it works in none yet:
  // it authenticates and reaches nothing until it is attached to one.
  projectIds?: number[];
  // External-agent runner scope (default: any member's runs).
  runnerScope?: RunnerScope;
  // The member creating the agent, who owns its runner.
  ownerUserId?: string | null;
}

// A handle addresses one person or one agent, never several: a mention is resolved
// against the members and the agents of the project at once, and by the lowercased
// handle, so a name a member already answers to cannot be issued to an agent and two
// agents of a team cannot differ by case alone. The agents of a team are held to that
// by the unique index on (team_id, lower(username)); the check here turns a conflict
// into a message that names which side took the handle. The reverse check sits in
// @repo/auth, where a member's username is set.
async function assertUsernameFree(
  teamId: number,
  username: string,
  exceptAgentId?: number,
): Promise<void> {
  const handle = username.toLowerCase();
  if ((await db.$count(user, eq(user.username, handle))) > 0)
    throw new HttpError(409, 'A member already uses this username');
  const conflicts = and(
    eq(aiAgent.teamId, teamId),
    eq(sql`lower(${aiAgent.username})`, handle),
    exceptAgentId == null ? undefined : ne(aiAgent.id, exceptAgentId),
  );
  if ((await db.$count(aiAgent, conflicts)) > 0)
    throw new HttpError(409, 'An agent with this username already exists');
}

// Issues a fresh API key owned by the agent's bot user and returns its plaintext
// value (only available at creation). The server-side call sets the owner via
// userId — better-auth allows this only for a direct (non-request) server call.
//
// The key carries no expiry, unlike a personal one: an internal agent replays its
// stored secret with nothing that would renew it, and an external agent's key is
// rotated by its operator through regenerate-key. The plugin puts its default on
// every key it creates, so the expiry is cleared on the row afterwards.
async function issueKey(userId: string, name: string): Promise<string> {
  const created = await auth.api.createApiKey({ body: { userId, name: `agent:${name}` } });
  await db.update(apikey).set({ expiresAt: null }).where(eq(apikey.id, created.id));
  return created.key;
}

// Creates an agent: a bot user, the ai_agent config row, its team and project
// memberships, and its first API key. Internal-agent config fields are stored only for
// kind "internal"; an external agent keeps them null.
//
// Returns the agent plus the one-time key secret. That secret is returned only for
// an external agent, whose operator must copy it — an internal agent's key is kept
// encrypted on the row for its own runtime and is never surfaced to a caller.
export async function createAgent(
  teamId: number,
  input: NewAgentInput,
): Promise<{ agent: AiAgentRow; apiKey: string | null }> {
  const userId = crypto.randomUUID();
  const email = `${userId}@agents.local`;
  const isInternal = input.kind === 'internal';
  await assertUsernameFree(teamId, input.username);
  if (isInternal) await assertModelCredential(teamId, input.modelCredentialId);
  const projectIds = await resolveTeamProjectIds(teamId, input.projectIds ?? []);
  // An agent joins a project the way a person accepting an invite does: on the team's
  // default role, changed per project from the project's member list afterwards.
  const roleId = await getDefaultRoleId(teamId);

  const agentId = await db.transaction(async (tx) => {
    await tx
      .insert(user)
      .values({ id: userId, name: input.name, email, emailVerified: false, role: 'user' });
    try {
      const [row] = await tx
        .insert(aiAgent)
        .values({
          teamId,
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
          ownerUserId: input.ownerUserId ?? null,
          runnerScope: input.runnerScope ?? 'team',
        })
        .returning({ id: aiAgent.id });
      // The agent belongs to the team's member list like a person does, on a standing
      // of its own that closes the owner and manager guards to it.
      await tx.insert(teamMember).values({ teamId, userId, role: 'agent' });
      if (projectIds.length > 0) {
        await tx
          .insert(projectMember)
          .values(projectIds.map((projectId) => ({ projectId, userId, role: 'member', roleId })));
      }
      return row.id;
    } catch (err) {
      rethrowDuplicate(err, 'An agent with this username');
      throw err;
    }
  });

  if (input.fieldTriggers?.length) {
    await setFieldTriggers(agentId, projectIds, input.fieldTriggers);
  }

  // Issued outside the transaction: better-auth writes the key through its own
  // connection, so it cannot join this one.
  const apiKey = await issueKey(userId, input.name);
  if (isInternal) await storeAgentKey(agentId, apiKey);
  const agent = (await getAgentById(agentId, teamId))!;
  return { agent, apiKey: isInternal ? null : apiKey };
}

// Replaces the projects the agent works in. Membership is what gives its key access,
// so this is the whole of attaching and detaching: a project left out is detached, and
// the runs, threads and issues it produced there are untouched. A project it already
// works in keeps the role that membership carries.
async function setAgentProjects(agent: AiAgentRow, projectIds: number[]): Promise<number[]> {
  const wanted = await resolveTeamProjectIds(agent.teamId, projectIds);
  const roleId = await getDefaultRoleId(agent.teamId);
  await db.transaction(async (tx) => {
    await tx
      .delete(projectMember)
      .where(
        and(
          eq(projectMember.userId, agent.userId),
          wanted.length > 0 ? notInArray(projectMember.projectId, wanted) : undefined,
        ),
      );
    // A column cannot keep assigning issues to an agent that no longer works in the
    // project, the same rule remove_member follows.
    await tx
      .update(projectColumn)
      .set({ autoAssignUserId: null })
      .where(
        and(
          eq(projectColumn.autoAssignUserId, agent.userId),
          wanted.length > 0 ? notInArray(projectColumn.projectId, wanted) : undefined,
        ),
      );
    if (wanted.length > 0) {
      await tx
        .insert(projectMember)
        .values(
          wanted.map((projectId) => ({
            projectId,
            userId: agent.userId,
            role: 'member',
            roleId,
          })),
        )
        .onConflictDoNothing();
    }
  });
  return wanted;
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
// secret (and may predate the team membership too), so both are filled in on first use
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
      .insert(teamMember)
      .values({ teamId: agent.teamId, userId: agent.userId, role: 'agent' })
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
  // The projects the agent works in. Replaces the set, so a project left out is
  // detached.
  projectIds?: number[];
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
  runnerScope?: RunnerScope;
}

export async function updateAgent(
  id: number,
  teamId: number,
  patch: AgentPatch,
  // The member making the change: choosing the 'owner' scope means their own runs.
  actorUserId: string,
): Promise<AiAgentRow | null> {
  const agent = await getAgentById(id, teamId);
  if (!agent) return null;
  await assertModelCredential(teamId, patch.modelCredentialId);

  // The display name lives on the bot user.
  if (patch.name !== undefined) {
    await db.update(user).set({ name: patch.name }).where(eq(user.id, agent.userId));
  }

  const set: Partial<typeof aiAgent.$inferInsert> = {};
  if (patch.username !== undefined) {
    await assertUsernameFree(teamId, patch.username, id);
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
        .where(and(eq(aiAgent.id, id), eq(aiAgent.teamId, teamId)));
    } catch (err) {
      rethrowDuplicate(err, 'An agent with this username');
      throw err;
    }
  }
  // The projects go first, so a field trigger of a project the same call attaches is
  // kept rather than dropped as unknown.
  const projectIds =
    patch.projectIds !== undefined
      ? await setAgentProjects(agent, patch.projectIds)
      : agent.projects.map((p) => p.id);
  if (patch.fieldTriggers !== undefined) {
    await setFieldTriggers(id, projectIds, patch.fieldTriggers);
  }

  return getAgentById(id, teamId);
}

// Replaces the agent's API key: deletes the current key row(s) for the bot user
// and issues a new one. Returns the new plaintext secret, or null if the agent
// does not exist. There is no atomic rotate in the plugin, so this is delete+create.
// An internal agent's new secret is re-encrypted onto its row for its runtime.
export async function regenerateKey(id: number, teamId: number): Promise<string | null> {
  const agent = await getAgentById(id, teamId);
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
export async function deleteAgent(id: number, teamId: number): Promise<boolean> {
  const agent = await getAgentById(id, teamId);
  if (!agent) return false;
  await deleteThreadsWhere({ agentId: id });
  await db.delete(apikey).where(eq(apikey.referenceId, agent.userId));
  await deleteAccount(agent.userId);
  return true;
}

// True if the agent belongs to the team (guards addressing an agent by id).
export async function agentInTeam(
  agentId: number,
  teamId: number,
  visibleTo?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(
      and(
        eq(aiAgent.id, agentId),
        eq(aiAgent.teamId, teamId),
        visibleTo == null ? undefined : sharesProjectWith(visibleTo),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// True if the agent works in the project (guards naming an agent for work there).
export async function agentWorksInProject(agentId: number, projectId: number): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(and(eq(aiAgent.id, agentId), inProject(projectId)))
    .limit(1);
  return rows.length > 0;
}
