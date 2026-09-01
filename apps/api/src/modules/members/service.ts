import {
  db,
  projectMember,
  projectRole,
  projectColumn,
  user,
  aiAgent,
  userPreference,
} from '@repo/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { DEFAULT_TIMEZONE } from '#modules/user-preferences/service';
import {
  defaultMemberPermissions,
  fullPermissions,
  hasPermission,
  normalizePermissions,
  type Permissions,
} from '#shared/permissions';

// Data access for project membership: which users can reach a project and their
// role in it ("owner" or "member"). Access checks resolve the owning project of
// any entity and look for the current user here.

export type MemberRole = 'owner' | 'member';

// How a membership came about. 'scim' rows are owned by the group reconciliation,
// which rewrites them on every sync, so they are not editable by hand.
export type MemberSource = 'invite' | 'scim';

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  // The sign-in name, shown next to the address in the members list. Null for an
  // agent's bot user, which is written by a direct insert and never gets one.
  username: string | null;
  // The zone this member reads timestamps in. Falls back to the same default as
  // their preferences do while they have not chosen one.
  timezone: string;
  image: string | null;
  role: MemberRole;
  // The custom role assigned to a member, or null. Owners bypass roles, so their
  // roleId is always null.
  roleId: number | null;
  roleName: string | null;
  // What this member does in the project, free text set by an owner. Empty when unset.
  description: string;
  // True when this member is an AI agent's bot user (has an ai_agent row). Agents
  // join by agent creation, not an invite, so their role and access are managed on
  // the AI Agents screen, not here.
  isAgent: boolean;
  source: MemberSource;
  createdAt: string;
}

// A member's effective access in a project: the owner/member flag plus the
// resolved permission matrix. Owners get the full matrix; a member resolves it
// from their assigned role, falling back to the default member matrix when no
// role is set.
export interface MemberContext {
  role: MemberRole;
  permissions: Permissions;
}

// Where a membership came from, or null when the user is not a member. Read by the
// routes that edit a membership, which refuse to touch a row SCIM owns.
export async function getMembershipSource(
  projectId: number,
  userId: string,
): Promise<MemberSource | null> {
  const rows = await db
    .select({ source: projectMember.source })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return rows[0] ? (rows[0].source as MemberSource) : null;
}

// The current user's role in a project, or null when they are not a member.
export async function getMembership(projectId: number, userId: string): Promise<MemberRole | null> {
  const rows = await db
    .select({ role: projectMember.role })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return rows[0] ? (rows[0].role as MemberRole) : null;
}

export function toMemberContext(role: MemberRole, rolePermissions: unknown): MemberContext {
  if (role === 'owner') return { role, permissions: fullPermissions() };
  return {
    role,
    permissions: rolePermissions
      ? normalizePermissions(rolePermissions)
      : defaultMemberPermissions(),
  };
}

// The current user's role and resolved permission matrix in a project, or null
// when they are not a member. This is the single lookup behind assertPermission.
export async function getMemberContext(
  projectId: number,
  userId: string,
): Promise<MemberContext | null> {
  const rows = await db
    .select({
      role: projectMember.role,
      permissions: projectRole.permissions,
    })
    .from(projectMember)
    .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  const r = rows[0];
  return r ? toMemberContext(r.role as MemberRole, r.permissions) : null;
}

// Every member's resolved access in the project, keyed by user id — getMemberContext
// in bulk, for a caller that judges several people at once (agents included: their
// bot user is a member like any other).
export async function listMemberContexts(projectId: number): Promise<Map<string, MemberContext>> {
  const rows = await db
    .select({
      userId: projectMember.userId,
      role: projectMember.role,
      permissions: projectRole.permissions,
    })
    .from(projectMember)
    .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
    .where(eq(projectMember.projectId, projectId));
  return new Map(rows.map((r) => [r.userId, toMemberContext(r.role as MemberRole, r.permissions)]));
}

// A candidate an issue can be assigned to: a project member (a real user) or an
// AI agent (its bot user). Both are `user` rows, so assignment and authorship use
// user.id uniformly; `kind` lets the UI group "Members" and "AI Agents".
export interface AssigneeCandidate {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. Null for a member who has none.
  username: string | null;
  image: string | null;
  kind: 'member' | 'agent';
  agentKind: 'external' | 'internal' | null;
  // For a member: their owner/member flag and their project description, so callers
  // (the agent tool) can pick who to tag. Null for an agent.
  role: MemberRole | null;
  description: string | null;
  // The user an 'owner'-scoped external agent works for: only their runs reach its
  // runner, so delegating it to anyone else does nothing. Null for everyone else.
  restrictedToUserId: string | null;
  canReadWorkItems: boolean;
}

export async function listAssigneeCandidates(projectId: number): Promise<AssigneeCandidate[]> {
  const [memberRows, agentRows] = await Promise.all([
    db
      .select({
        userId: projectMember.userId,
        name: user.name,
        email: user.email,
        username: user.username,
        image: user.image,
        role: projectMember.role,
        permissions: projectRole.permissions,
        description: projectMember.description,
      })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      // An agent's bot user also holds a project_member row (that is how it gets its
      // permissions). It is listed below as kind 'agent', so it is excluded here to
      // keep the member candidates real people only. Same agent test as listMembers.
      .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
      .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
      .where(and(eq(projectMember.projectId, projectId), isNull(aiAgent.id))),
    db
      .select({
        userId: aiAgent.userId,
        name: user.name,
        email: user.email,
        username: aiAgent.username,
        image: user.image,
        agentKind: aiAgent.kind,
        ownerUserId: aiAgent.ownerUserId,
        runnerScope: aiAgent.runnerScope,
      })
      .from(aiAgent)
      .innerJoin(user, eq(user.id, aiAgent.userId))
      .where(eq(aiAgent.projectId, projectId)),
  ]);
  const members: AssigneeCandidate[] = memberRows.map((r) => {
    const context = toMemberContext(r.role as MemberRole, r.permissions);
    return {
      userId: r.userId,
      name: r.name,
      email: r.email,
      username: r.username,
      image: r.image,
      kind: 'member',
      agentKind: null,
      role: r.role as MemberRole,
      description: r.description,
      restrictedToUserId: null,
      canReadWorkItems:
        context.role === 'owner' || hasPermission(context.permissions, 'work_items', 'read'),
    };
  });
  const agents: AssigneeCandidate[] = agentRows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    username: r.username,
    image: r.image,
    kind: 'agent',
    agentKind: r.agentKind as 'external' | 'internal',
    role: null,
    description: null,
    restrictedToUserId: r.runnerScope === 'owner' ? r.ownerUserId : null,
    canReadWorkItems: false,
  }));
  return [...members, ...agents].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMembers(projectId: number): Promise<MemberRow[]> {
  const rows = await db
    .select({
      userId: projectMember.userId,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      timezone: userPreference.timezone,
      role: projectMember.role,
      roleId: projectMember.roleId,
      roleName: projectRole.name,
      description: projectMember.description,
      source: projectMember.source,
      agentId: aiAgent.id,
      createdAt: projectMember.createdAt,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
    .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
    .leftJoin(userPreference, eq(userPreference.userId, projectMember.userId))
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.createdAt);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    username: r.username,
    image: r.image,
    timezone: r.timezone ?? DEFAULT_TIMEZONE,
    role: r.role as MemberRole,
    roleId: r.roleId,
    roleName: r.roleName,
    description: r.description,
    isAgent: r.agentId !== null,
    source: r.source as MemberSource,
    createdAt: iso(r.createdAt),
  }));
}

// Sets a member's project description (what they do). Returns false when the user is
// not a member of the project.
export async function setMemberDescription(
  projectId: number,
  userId: string,
  description: string,
): Promise<boolean> {
  const updated = await db
    .update(projectMember)
    .set({ description })
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning({ userId: projectMember.userId });
  return updated.length > 0;
}

// Adds a user to a project. Upserts the role when the user is already a member,
// so re-adding is idempotent and doubles as a role change.
export async function upsertMember(
  projectId: number,
  userId: string,
  role: MemberRole,
): Promise<void> {
  await db
    .insert(projectMember)
    .values({ projectId, userId, role })
    .onConflictDoUpdate({
      target: [projectMember.projectId, projectMember.userId],
      set: { role },
    });
}

// Sets a member's owner/member flag and custom role in one update. Promoting to
// owner clears the role (owners bypass roles), so callers pass roleId null there;
// a member keeps roleId (null falls back to the default role). Returns false when
// the user is not a member of the project.
export async function setMembership(
  projectId: number,
  userId: string,
  role: MemberRole,
  roleId: number | null,
): Promise<boolean> {
  const updated = await db
    .update(projectMember)
    .set({ role, roleId })
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning({ userId: projectMember.userId });
  return updated.length > 0;
}

export async function removeMember(projectId: number, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
    // A column cannot keep assigning issues to someone who is no longer a member:
    // the same assignment sent as a patch would be refused.
    await tx
      .update(projectColumn)
      .set({ autoAssignUserId: null })
      .where(
        and(eq(projectColumn.projectId, projectId), eq(projectColumn.autoAssignUserId, userId)),
      );
  });
}

export async function countOwners(projectId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.role, 'owner')));
  return rows[0]?.count ?? 0;
}
