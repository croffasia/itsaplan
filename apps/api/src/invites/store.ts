import { db, projectInvite, projectMember, projectRole, project, user } from '@repo/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HttpError, iso, pgErrorCode } from '../shared/lib';
import type { MemberRole } from '../members/store';

// Data access for project invites. An invite is a token-addressed grant of a
// role to an email in a project. Creating one requires the project owner;
// accepting it (email must match the session) creates the project_member row.

export type InviteStatus = 'pending' | 'accepted' | 'rejected';

// Row shown to the owner managing invites. Includes the token so the owner can
// share the link, and who sent it.
export interface InviteRow {
  id: number;
  token: string;
  email: string;
  role: MemberRole;
  // The custom role the invitee joins on (for a "member" invite). roleId is null
  // when the invite falls back to the default role; roleName resolves it for
  // display. An "owner" invite has both null.
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  respondedAt: string | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

// Row shown to the invitee opening the link, with enough project context to
// decide. Never exposes the internal project id.
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
  // Whether the invited email already has an account. Lets the accept screen
  // open in sign-in mode instead of registration. Scoped to the one email bound
  // to this (unguessable) token, so it is not a general existence oracle.
  hasAccount: boolean;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function createInvite(input: {
  projectId: number;
  email: string;
  role: MemberRole;
  roleId: number | null;
  invitedByUserId: string;
}): Promise<InviteRow> {
  const email = normalizeEmail(input.email);
  // Owners bypass roles, so an owner invite never carries a role_id.
  const roleId = input.role === 'member' ? input.roleId : null;
  let row;
  try {
    [row] = await db
      .insert(projectInvite)
      .values({
        projectId: input.projectId,
        email,
        role: input.role,
        roleId,
        invitedByUserId: input.invitedByUserId,
      })
      .returning({ id: projectInvite.id });
  } catch (err) {
    if (pgErrorCode(err) === '23505') {
      throw new HttpError(409, 'A pending invite for this email already exists');
    }
    throw err;
  }
  return (await getInviteById(input.projectId, row.id))!;
}

export async function getInviteById(projectId: number, id: number): Promise<InviteRow | null> {
  const rows = await db
    .select({
      id: projectInvite.id,
      token: projectInvite.token,
      email: projectInvite.email,
      role: projectInvite.role,
      roleId: projectInvite.roleId,
      roleName: projectRole.name,
      status: projectInvite.status,
      createdAt: projectInvite.createdAt,
      respondedAt: projectInvite.respondedAt,
      invitedByName: user.name,
      invitedByEmail: user.email,
    })
    .from(projectInvite)
    .leftJoin(user, eq(user.id, projectInvite.invitedByUserId))
    .leftJoin(projectRole, eq(projectRole.id, projectInvite.roleId))
    .where(and(eq(projectInvite.projectId, projectId), eq(projectInvite.id, id)));
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    token: r.token,
    email: r.email,
    role: r.role as MemberRole,
    roleId: r.roleId,
    roleName: r.roleName,
    status: r.status as InviteStatus,
    createdAt: iso(r.createdAt),
    respondedAt: r.respondedAt ? iso(r.respondedAt) : null,
    invitedByName: r.invitedByName,
    invitedByEmail: r.invitedByEmail,
  };
}

export async function listInvites(projectId: number): Promise<InviteRow[]> {
  const rows = await db
    .select({
      id: projectInvite.id,
      token: projectInvite.token,
      email: projectInvite.email,
      role: projectInvite.role,
      roleId: projectInvite.roleId,
      roleName: projectRole.name,
      status: projectInvite.status,
      createdAt: projectInvite.createdAt,
      respondedAt: projectInvite.respondedAt,
      invitedByName: user.name,
      invitedByEmail: user.email,
    })
    .from(projectInvite)
    .leftJoin(user, eq(user.id, projectInvite.invitedByUserId))
    .leftJoin(projectRole, eq(projectRole.id, projectInvite.roleId))
    .where(eq(projectInvite.projectId, projectId))
    .orderBy(desc(projectInvite.createdAt));
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    email: r.email,
    role: r.role as MemberRole,
    roleId: r.roleId,
    roleName: r.roleName,
    status: r.status as InviteStatus,
    createdAt: iso(r.createdAt),
    respondedAt: r.respondedAt ? iso(r.respondedAt) : null,
    invitedByName: r.invitedByName,
    invitedByEmail: r.invitedByEmail,
  }));
}

// Removes an invite row. Returns true when one existed. Used to revoke a pending
// invite or clean up a resolved one.
export async function deleteInvite(projectId: number, id: number): Promise<boolean> {
  const deleted = await db
    .delete(projectInvite)
    .where(and(eq(projectInvite.projectId, projectId), eq(projectInvite.id, id)))
    .returning({ id: projectInvite.id });
  return deleted.length > 0;
}

// The invite behind a link, with its project context, or null if the token is
// unknown.
export async function getInviteByToken(token: string): Promise<InviteView | null> {
  const rows = await db
    .select({
      token: projectInvite.token,
      projectKey: project.key,
      projectName: project.name,
      email: projectInvite.email,
      role: projectInvite.role,
      roleId: projectInvite.roleId,
      roleName: projectRole.name,
      status: projectInvite.status,
      createdAt: projectInvite.createdAt,
    })
    .from(projectInvite)
    .innerJoin(project, eq(project.id, projectInvite.projectId))
    .leftJoin(projectRole, eq(projectRole.id, projectInvite.roleId))
    .where(eq(projectInvite.token, token));
  const r = rows[0];
  if (!r) return null;
  // The invite email is stored normalized (lowercase); compare case-insensitively
  // against the account email, which better-auth does not guarantee is lowercased.
  const account = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, r.email))
    .limit(1);
  return {
    token: r.token,
    projectKey: r.projectKey,
    projectName: r.projectName,
    email: r.email,
    role: r.role as MemberRole,
    roleId: r.roleId,
    roleName: r.roleName,
    status: r.status as InviteStatus,
    createdAt: iso(r.createdAt),
    hasAccount: account.length > 0,
  };
}

// The raw invite fields needed to act on it (accept/reject/match email).
export async function getInviteRowByToken(token: string) {
  const rows = await db
    .select({
      id: projectInvite.id,
      projectId: projectInvite.projectId,
      email: projectInvite.email,
      role: projectInvite.role,
      roleId: projectInvite.roleId,
      status: projectInvite.status,
    })
    .from(projectInvite)
    .where(eq(projectInvite.token, token));
  return rows[0] ?? null;
}

// Accepts a pending invite: creates (or updates) the membership and marks the
// invite accepted, in one transaction. The caller has already checked the
// invite is pending and the session email matches.
export async function acceptInvite(
  invite: { id: number; projectId: number; role: string; roleId: number | null },
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // A member joins on the invite's chosen role, falling back to the project's
    // default role when none was set; an owner bypasses roles.
    let roleId: number | null = null;
    if (invite.role === 'member') {
      if (invite.roleId != null) {
        roleId = invite.roleId;
      } else {
        const [def] = await tx
          .select({ id: projectRole.id })
          .from(projectRole)
          .where(and(eq(projectRole.projectId, invite.projectId), eq(projectRole.isDefault, true)));
        roleId = def?.id ?? null;
      }
    }
    await tx
      .insert(projectMember)
      .values({ projectId: invite.projectId, userId, role: invite.role, roleId })
      .onConflictDoUpdate({
        target: [projectMember.projectId, projectMember.userId],
        set: { role: invite.role, roleId },
      });
    await tx
      .update(projectInvite)
      .set({ status: 'accepted', acceptedByUserId: userId, respondedAt: new Date() })
      .where(eq(projectInvite.id, invite.id));
  });
}

export async function rejectInvite(inviteId: number): Promise<void> {
  await db
    .update(projectInvite)
    .set({ status: 'rejected', respondedAt: new Date() })
    .where(eq(projectInvite.id, inviteId));
}
