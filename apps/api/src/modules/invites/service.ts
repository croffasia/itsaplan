import { db, teamInvite, teamMember, projectMember, teamRole, team, project, user } from '@repo/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError, iso, pgErrorCode } from '#shared/lib';
import { getMembership, type MemberRole } from '#modules/members/service';
import {
  assertTeamSeatFree,
  getTeamMembership,
  runsTeam,
  type TeamRole,
} from '#modules/teams/service';

// Data access for invites. An invite is a token-addressed grant of membership in a
// team, and — when it names a project — in that project too. Creating one requires
// standing in the team or the project (see the routes); accepting it (email must
// match the session) creates the team_member row and, for a project invite, the
// project_member row.

export type InviteStatus = 'pending' | 'accepted' | 'rejected';

// The rank an invite puts its invitee on in the team.
export type InviteTeamRole = TeamRole;

// The standings a team rank outranks. An invite never lowers a rank, so accepting one
// only rewrites a membership below the rank it grants.
const OUTRANKED: Record<TeamRole, TeamRole[]> = {
  owner: ['manager', 'member'],
  manager: ['member'],
  member: [],
};

// Row shown to whoever manages invites. Includes the token so they can share the
// link, and who sent it.
export interface InviteRow {
  id: number;
  token: string;
  email: string;
  teamRole: InviteTeamRole;
  // The project the invitee joins along with the team, or null for an invite into
  // the team alone.
  projectKey: string | null;
  projectName: string | null;
  // The role in that project. Null when the invite names no project.
  role: MemberRole | null;
  // The custom role a project member joins on. roleId is null when the invite falls
  // back to the team's default role; roleName resolves it for display. A project
  // owner has both null.
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  respondedAt: string | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

// Row shown to the invitee opening the link, with enough context to decide. Never
// exposes the internal team or project id.
export interface InviteView {
  token: string;
  teamName: string;
  projectKey: string | null;
  projectName: string | null;
  email: string;
  teamRole: InviteTeamRole;
  role: MemberRole | null;
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  // Whether the invited email already has an account. Lets the accept screen
  // open in sign-in mode instead of registration. Scoped to the one email bound
  // to this (unguessable) token, so it is not a general existence oracle.
  hasAccount: boolean;
}

// Where an invitee landed once the invite was accepted.
export interface AcceptedInvite {
  teamName: string;
  projectKey: string | null;
  projectName: string | null;
  role: MemberRole | null;
}

export interface NewInvite {
  teamId: number;
  projectId: number | null;
  email: string;
  teamRole: InviteTeamRole;
  // The role in the project, for an invite that names one.
  projectRole: MemberRole | null;
  roleId: number | null;
  invitedByUserId: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// The manager-facing shape of an invite, resolving the project, the custom role and
// the sender. Every listing selects through this.
function selectInvites() {
  return db
    .select({
      id: teamInvite.id,
      token: teamInvite.token,
      email: teamInvite.email,
      teamRole: teamInvite.teamRole,
      projectKey: project.key,
      projectName: project.name,
      role: teamInvite.projectRole,
      roleId: teamInvite.roleId,
      roleName: teamRole.name,
      status: teamInvite.status,
      createdAt: teamInvite.createdAt,
      respondedAt: teamInvite.respondedAt,
      invitedByName: user.name,
      invitedByEmail: user.email,
    })
    .from(teamInvite)
    .leftJoin(project, eq(project.id, teamInvite.projectId))
    .leftJoin(user, eq(user.id, teamInvite.invitedByUserId))
    .leftJoin(teamRole, eq(teamRole.id, teamInvite.roleId));
}

type InviteSelection = Awaited<ReturnType<ReturnType<typeof selectInvites>['execute']>>[number];

function toRow(r: InviteSelection): InviteRow {
  return {
    id: r.id,
    token: r.token,
    email: r.email,
    teamRole: r.teamRole as InviteTeamRole,
    projectKey: r.projectKey,
    projectName: r.projectName,
    role: r.role as MemberRole | null,
    roleId: r.roleId,
    roleName: r.roleName,
    status: r.status as InviteStatus,
    createdAt: iso(r.createdAt),
    respondedAt: r.respondedAt ? iso(r.respondedAt) : null,
    invitedByName: r.invitedByName,
    invitedByEmail: r.invitedByEmail,
  };
}

// The account behind an email, or undefined when nobody signed up with it. The invite
// email is stored normalized (lowercase); the account email is compared
// case-insensitively because better-auth does not guarantee it is lowercased.
async function findAccount(email: string): Promise<{ id: string } | undefined> {
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email))
    .limit(1);
  return account;
}

// An address already inside the team takes no invite. Accepting one rewrites the
// membership the account already holds, which is how a project's last owner would be
// demoted to member; a team member reaches a project through its member list instead.
async function assertNotAlreadyMember(input: NewInvite, email: string): Promise<void> {
  const account = await findAccount(email);
  if (!account) return;

  if (input.projectId != null && (await getMembership(input.projectId, account.id))) {
    throw new HttpError(
      409,
      'This user is already a member of the project',
      'ALREADY_PROJECT_MEMBER',
    );
  }
  if (await getTeamMembership(input.teamId, account.id)) {
    throw new HttpError(
      409,
      input.projectId == null
        ? 'This user is already a member of the team'
        : 'This user is already in the team. Add them to the project from its member list.',
      'ALREADY_TEAM_MEMBER',
    );
  }
}

// The ranks an invite hands out, and the sender it is checked against. Read when the
// invite is created and again when it is accepted: the standing that issued the link
// can be gone by the time the invitee opens it, and a link must not outlive it.
//
// Project ownership takes an owner of the project or someone who runs the team that
// owns it — the standing members/ asks for, since an owner bypasses the role matrix.
// A team rank above 'member' takes a team owner. Everything else takes nothing beyond
// the route's own guard.
export async function mayGrantInviteRanks(
  invite: {
    teamId: number;
    projectId: number | null;
    teamRole: string;
    projectRole: string | null;
  },
  senderId: string | null,
): Promise<boolean> {
  const grantsTeamRank = invite.teamRole !== 'member';
  const grantsProjectOwner = invite.projectRole === 'owner';
  if (!grantsTeamRank && !grantsProjectOwner) return true;
  if (!senderId) return false;

  const standing = await getTeamMembership(invite.teamId, senderId);
  if (grantsTeamRank && standing !== 'owner') return false;
  if (grantsProjectOwner && !runsTeam(standing)) {
    return (await getMembership(invite.projectId!, senderId)) === 'owner';
  }
  return true;
}

export async function createInvite(input: NewInvite): Promise<InviteRow> {
  const email = normalizeEmail(input.email);
  await assertNotAlreadyMember(input, email);
  // Project owners bypass roles, so an owner invite never carries a role_id.
  const roleId = input.projectRole === 'member' ? input.roleId : null;
  let row;
  try {
    [row] = await db
      .insert(teamInvite)
      .values({
        teamId: input.teamId,
        projectId: input.projectId,
        email,
        teamRole: input.teamRole,
        projectRole: input.projectRole,
        roleId,
        invitedByUserId: input.invitedByUserId,
      })
      .returning({ id: teamInvite.id });
  } catch (err) {
    if (pgErrorCode(err) === '23505') {
      throw new HttpError(
        409,
        'A pending invite for this email already exists',
        'INVITE_ALREADY_PENDING',
      );
    }
    throw err;
  }
  return (await getInviteById(row.id))!;
}

export async function getInviteById(id: number): Promise<InviteRow | null> {
  const rows = await selectInvites().where(eq(teamInvite.id, id));
  return rows[0] ? toRow(rows[0]) : null;
}

export async function listProjectInvites(projectId: number): Promise<InviteRow[]> {
  const rows = await selectInvites()
    .where(eq(teamInvite.projectId, projectId))
    .orderBy(desc(teamInvite.createdAt));
  return rows.map(toRow);
}

// Every invite of the team, including the ones that also name one of its projects:
// whoever runs the team sees who was invited anywhere in it.
export async function listTeamInvites(teamId: number): Promise<InviteRow[]> {
  const rows = await selectInvites()
    .where(eq(teamInvite.teamId, teamId))
    .orderBy(desc(teamInvite.createdAt));
  return rows.map(toRow);
}

// Removes an invite of the given project. Returns true when one existed. Used to
// revoke a pending invite or clean up a resolved one.
export async function deleteProjectInvite(projectId: number, id: number): Promise<boolean> {
  const deleted = await db
    .delete(teamInvite)
    .where(and(eq(teamInvite.projectId, projectId), eq(teamInvite.id, id)))
    .returning({ id: teamInvite.id });
  return deleted.length > 0;
}

export async function deleteTeamInvite(teamId: number, id: number): Promise<boolean> {
  const deleted = await db
    .delete(teamInvite)
    .where(and(eq(teamInvite.teamId, teamId), eq(teamInvite.id, id)))
    .returning({ id: teamInvite.id });
  return deleted.length > 0;
}

// The invite behind a link, with its team and project context, or null if the token
// is unknown.
export async function getInviteByToken(token: string): Promise<InviteView | null> {
  const rows = await db
    .select({
      token: teamInvite.token,
      teamName: team.name,
      projectKey: project.key,
      projectName: project.name,
      email: teamInvite.email,
      teamRole: teamInvite.teamRole,
      role: teamInvite.projectRole,
      roleId: teamInvite.roleId,
      roleName: teamRole.name,
      status: teamInvite.status,
      createdAt: teamInvite.createdAt,
    })
    .from(teamInvite)
    .innerJoin(team, eq(team.id, teamInvite.teamId))
    .leftJoin(project, eq(project.id, teamInvite.projectId))
    .leftJoin(teamRole, eq(teamRole.id, teamInvite.roleId))
    .where(eq(teamInvite.token, token));
  const r = rows[0];
  if (!r) return null;
  const account = await findAccount(r.email);
  return {
    token: r.token,
    teamName: r.teamName,
    projectKey: r.projectKey,
    projectName: r.projectName,
    email: r.email,
    teamRole: r.teamRole as InviteTeamRole,
    role: r.role as MemberRole | null,
    roleId: r.roleId,
    roleName: r.roleName,
    status: r.status as InviteStatus,
    createdAt: iso(r.createdAt),
    hasAccount: account != null,
  };
}

// The raw invite fields needed to act on it (accept/reject/match email).
export async function getInviteRowByToken(token: string) {
  const rows = await db
    .select({
      id: teamInvite.id,
      teamId: teamInvite.teamId,
      projectId: teamInvite.projectId,
      email: teamInvite.email,
      teamRole: teamInvite.teamRole,
      projectRole: teamInvite.projectRole,
      roleId: teamInvite.roleId,
      status: teamInvite.status,
      invitedByUserId: teamInvite.invitedByUserId,
    })
    .from(teamInvite)
    .where(eq(teamInvite.token, token));
  return rows[0] ?? null;
}

// Accepts a pending invite: joins the team, joins the project the invite names, and
// marks the invite accepted, in one transaction. The caller has already checked the
// invite is pending and the session email matches.
export async function acceptInvite(
  invite: {
    id: number;
    teamId: number;
    projectId: number | null;
    teamRole: string;
    projectRole: string | null;
    roleId: number | null;
  },
  userId: string,
): Promise<AcceptedInvite> {
  // The invitee can join the project between the invite and this accept — from its
  // member list, once they are in the team. Writing the invite's role over that
  // membership would put an owner back on a member role, past the last-owner check
  // the member routes make, so the link is refused instead. The invite stays pending
  // and can still be rejected.
  if (invite.projectId != null && (await getMembership(invite.projectId, userId))) {
    throw new HttpError(409, 'You are already a member of this project', 'ALREADY_PROJECT_MEMBER');
  }

  // Somebody already in the team takes no further seat: the accept only rewrites the
  // rank they hold.
  if (!(await getTeamMembership(invite.teamId, userId))) await assertTeamSeatFree(invite.teamId);

  return db.transaction(async (tx) => {
    // An invite is refused for an address already in the team, so a conflict here is
    // someone who joined between the invite and this accept. setWhere rewrites only a
    // standing the invite outranks: an invite never lowers a rank.
    const outranked = OUTRANKED[invite.teamRole as TeamRole] ?? [];
    await tx
      .insert(teamMember)
      .values({ teamId: invite.teamId, userId, role: invite.teamRole })
      .onConflictDoUpdate({
        target: [teamMember.teamId, teamMember.userId],
        set: { role: invite.teamRole },
        setWhere: outranked.length > 0 ? inArray(teamMember.role, outranked) : sql`false`,
      });

    if (invite.projectId != null) {
      // A member joins on the invite's chosen role, falling back to the team's
      // default role when none was set; a project owner bypasses roles.
      let roleId: number | null = null;
      if (invite.projectRole === 'member') {
        if (invite.roleId != null) {
          roleId = invite.roleId;
        } else {
          const [def] = await tx
            .select({ id: teamRole.id })
            .from(teamRole)
            .where(and(eq(teamRole.teamId, invite.teamId), eq(teamRole.isDefault, true)));
          roleId = def?.id ?? null;
        }
      }
      await tx
        .insert(projectMember)
        .values({
          projectId: invite.projectId,
          userId,
          role: invite.projectRole as MemberRole,
          roleId,
        })
        .onConflictDoUpdate({
          target: [projectMember.projectId, projectMember.userId],
          set: { role: invite.projectRole as MemberRole, roleId },
        });
    }

    await tx
      .update(teamInvite)
      .set({ status: 'accepted', acceptedByUserId: userId, respondedAt: new Date() })
      .where(eq(teamInvite.id, invite.id));

    const [joinedTeam] = await tx
      .select({ name: team.name })
      .from(team)
      .where(eq(team.id, invite.teamId));
    const [joinedProject] = invite.projectId
      ? await tx
          .select({ key: project.key, name: project.name })
          .from(project)
          .where(eq(project.id, invite.projectId))
      : [];
    return {
      teamName: joinedTeam.name,
      projectKey: joinedProject?.key ?? null,
      projectName: joinedProject?.name ?? null,
      role: invite.projectRole as MemberRole | null,
    };
  });
}

export async function rejectInvite(inviteId: number): Promise<void> {
  await db
    .update(teamInvite)
    .set({ status: 'rejected', respondedAt: new Date() })
    .where(eq(teamInvite.id, inviteId));
}
