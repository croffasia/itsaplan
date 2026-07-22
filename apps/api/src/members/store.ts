import { db, projectMember, projectRole, user, aiAgent } from '@repo/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { iso } from '../shared/lib';
import {
  defaultMemberPermissions,
  fullPermissions,
  normalizePermissions,
  type Permissions,
} from '../shared/permissions';

// Data access for project membership: which users can reach a project and their
// role in it ("owner" or "member"). Access checks resolve the owning project of
// any entity and look for the current user here.

export type MemberRole = 'owner' | 'member';

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
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

// The current user's role in a project, or null when they are not a member.
export async function getMembership(projectId: number, userId: string): Promise<MemberRole | null> {
  const rows = await db
    .select({ role: projectMember.role })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return rows[0] ? (rows[0].role as MemberRole) : null;
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
  if (!r) return null;
  const role = r.role as MemberRole;
  if (role === 'owner') return { role, permissions: fullPermissions() };
  const permissions = r.permissions
    ? normalizePermissions(r.permissions)
    : defaultMemberPermissions();
  return { role, permissions };
}

// A candidate an issue can be assigned to: a project member (a real user) or an
// AI agent (its bot user). Both are `user` rows, so assignment and authorship use
// user.id uniformly; `kind` lets the UI group "Members" and "AI Agents".
export interface AssigneeCandidate {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  kind: 'member' | 'agent';
  agentKind: 'external' | 'internal' | null;
  // For a member: their owner/member flag and their project description, so callers
  // (the agent tool) can pick who to tag. Null for an agent.
  role: MemberRole | null;
  description: string | null;
}

export async function listAssigneeCandidates(projectId: number): Promise<AssigneeCandidate[]> {
  const [memberRows, agentRows] = await Promise.all([
    db
      .select({
        userId: projectMember.userId,
        name: user.name,
        email: user.email,
        image: user.image,
        role: projectMember.role,
        description: projectMember.description,
      })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      // An agent's bot user also holds a project_member row (that is how it gets its
      // permissions). It is listed below as kind 'agent', so it is excluded here to
      // keep the member candidates real people only. Same agent test as listMembers.
      .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
      .where(and(eq(projectMember.projectId, projectId), isNull(aiAgent.id))),
    db
      .select({
        userId: aiAgent.userId,
        name: user.name,
        email: user.email,
        image: user.image,
        agentKind: aiAgent.kind,
      })
      .from(aiAgent)
      .innerJoin(user, eq(user.id, aiAgent.userId))
      .where(eq(aiAgent.projectId, projectId)),
  ]);
  const members: AssigneeCandidate[] = memberRows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    image: r.image,
    kind: 'member',
    agentKind: null,
    role: r.role as MemberRole,
    description: r.description,
  }));
  const agents: AssigneeCandidate[] = agentRows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    image: r.image,
    kind: 'agent',
    agentKind: r.agentKind as 'external' | 'internal',
    role: null,
    description: null,
  }));
  return [...members, ...agents].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMembers(projectId: number): Promise<MemberRow[]> {
  const rows = await db
    .select({
      userId: projectMember.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      role: projectMember.role,
      roleId: projectMember.roleId,
      roleName: projectRole.name,
      description: projectMember.description,
      agentId: aiAgent.id,
      createdAt: projectMember.createdAt,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
    .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.createdAt);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    image: r.image,
    role: r.role as MemberRole,
    roleId: r.roleId,
    roleName: r.roleName,
    description: r.description,
    isAgent: r.agentId !== null,
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
  await db
    .delete(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
}

export async function countOwners(projectId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.role, 'owner')));
  return rows[0]?.count ?? 0;
}
