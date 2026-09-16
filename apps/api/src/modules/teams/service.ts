import {
  agentSkill,
  agentTool,
  aiAgent,
  db,
  integrationCredential,
  issue,
  issueActivity,
  project,
  projectColumn,
  projectMember,
  team,
  teamMember,
  teamRole,
  user,
} from '@repo/db';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { getLimits } from '#shared/limits';
import { defaultMemberPermissions, fullPermissions, type Permissions } from '#shared/permissions';
import {
  getMemberContext,
  getMembership,
  getMembershipSource,
  getTeamPermissions,
  listMembersPage,
  matchesFilters,
  type MemberFilters,
  type MemberRole,
  type MemberSource,
} from '#modules/members/service';
import { getStats, type StatsDto } from '#modules/analytics/service';

// The rank a person holds in a team.
export type TeamRole = 'owner' | 'manager' | 'member';

// What a team_member row can say. An agent's bot user belongs to the team and appears
// in its member list, but its standing grants nothing: what it may do is the team role
// on its ai_agent row.
export type TeamStanding = TeamRole | 'agent';

// Owners and managers run the team, so they hold everything it can grant. Everyone
// else — a member, and an agent — holds what their project roles in it grant.
export function runsTeam(standing: TeamStanding | null): boolean {
  return standing === 'owner' || standing === 'manager';
}

export interface TeamRow {
  id: number;
  name: string;
  // Whether the team is reachable over MCP at all. Off closes its own resources and
  // every project it owns, whichever projects it covers.
  mcpEnabled: boolean;
  // The caller's standing in the team, not a property of the team itself. An agent
  // reading its own team is 'agent', which runs nothing.
  role: TeamStanding;
  // How the caller's own membership came about. 'scim' is the identity provider's, and
  // is left there rather than here.
  source: MemberSource;
  joinedAt: string;
  projectCount: number;
  memberCount: number;
  // How many of those members are owners: the last one cannot leave.
  ownerCount: number;
  // The roles the team's projects assign from, the integration credentials they run
  // on, the agents that work in them, and the skills and tools those agents use.
  // Counted here so the page shows them beside the section without opening it.
  roleCount: number;
  integrationCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
  createdAt: string;
}

// One member of a team, as the team detail lists them: a person, or the bot user of
// one of the team's agents. An agent carries the id and handle it is addressed by; its
// standing in the team is 'agent', and what it may do is the role each of its project
// memberships carries.
export interface TeamMemberRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: TeamStanding;
  source: MemberSource;
  agentId: number | null;
  username: string | null;
  joinedAt: string;
}

// A project the team owns. `isMember` is the caller's own access to it: a team
// member sees every project of the team, but only opens the ones they belong to.
export interface TeamProjectRow {
  id: number;
  key: string;
  name: string;
  description: string;
  // Whether the team's MCP reach covers this project. Only counts while the team's
  // own switch is on.
  mcpEnabled: boolean;
  memberCount: number;
  owners: { userId: string; name: string; image: string | null }[];
  isMember: boolean;
  createdAt: string;
}

// One page of the team's projects, with how many the caller reads in all.
export interface TeamProjectPage {
  items: TeamProjectRow[];
  total: number;
}

// A project as a picker reads it, plus the MCP reach the team's switches set.
export interface TeamProjectOption {
  id: number;
  key: string;
  name: string;
  mcpEnabled: boolean;
}

// One member of a project the team owns. The access their membership resolves to is
// not carried here: it is the matrix of the role they hold, which the reader already
// has from the team's roles.
export interface TeamProjectMemberRow {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. An agent's bot user carries the
  // agent's handle.
  username: string | null;
  image: string | null;
  isAgent: boolean;
  role: MemberRole;
  roleId: number | null;
  roleName: string | null;
  // What the member does in the project, and which path their membership came from —
  // both needed by the panel, which edits the membership from there.
  description: string;
  source: MemberSource;
  timezone: string;
  joinedAt: string;
}

// One project of the team, opened: how it is doing, and where the reader stands in
// it. Its members are a page of their own, so a project with many of them is not
// loaded whole.
export interface TeamProjectDetail {
  // The most recent entry in the project's issue feed, or null when nothing has
  // happened in it yet.
  lastActivityAt: string | null;
  stats: StatsDto;
  // The reader's own membership in this project, or null when they only reach it
  // through the team. What they may do with its members is decided from it.
  viewer: { role: MemberRole; source: MemberSource; permissions: Permissions } | null;
}

// One page of the team's members, with how many match the search.
export interface TeamMemberPage {
  items: TeamMemberRow[];
  total: number;
}

// One page of a project's members, with how many match the search.
export interface TeamProjectMemberPage {
  items: TeamProjectMemberRow[];
  total: number;
}

export interface TeamDetail extends TeamRow {
  // What the caller may do with the resources the team holds for all its projects.
  // Owners and managers run the team, so they get the full matrix; a member gets the
  // permissions of their project roles in it, merged.
  permissions: Permissions;
  // The people who run the team, owners first. Bounded by the standing they hold, so
  // it comes with the team rather than out of the paged member list.
  leads: TeamLeadRow[];
}

export interface TeamLeadRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: 'owner' | 'manager';
}

// The caller's teams as DTOs, optionally narrowed to one. Membership is the join,
// so a team the caller left is not returned at all.
async function loadTeamRows(userId: string, teamId?: number): Promise<TeamRow[]> {
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      mcpEnabled: team.mcpEnabled,
      role: teamMember.role,
      source: teamMember.source,
      joinedAt: teamMember.createdAt,
      createdAt: team.createdAt,
    })
    .from(teamMember)
    .innerJoin(team, eq(team.id, teamMember.teamId))
    .where(
      teamId === undefined
        ? eq(teamMember.userId, userId)
        : and(eq(teamMember.userId, userId), eq(team.id, teamId)),
    )
    .orderBy(team.id);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [
    projectCounts,
    memberCounts,
    roleCounts,
    integrationCounts,
    agentCounts,
    skillCounts,
    toolCounts,
  ] = await Promise.all([
    db
      .select({
        teamId: project.teamId,
        count: sql<number>`count(*)::int`,
        joined: sql<number>`count(${projectMember.userId})::int`,
      })
      .from(project)
      .leftJoin(
        projectMember,
        and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId)),
      )
      .where(inArray(project.teamId, ids))
      .groupBy(project.teamId),
    db
      .select({
        teamId: teamMember.teamId,
        count: sql<number>`count(*)::int`,
        owners: sql<number>`count(*) filter (where ${teamMember.role} = 'owner')::int`,
      })
      .from(teamMember)
      .where(inArray(teamMember.teamId, ids))
      .groupBy(teamMember.teamId),
    db
      .select({ teamId: teamRole.teamId, count: sql<number>`count(*)::int` })
      .from(teamRole)
      .where(inArray(teamRole.teamId, ids))
      .groupBy(teamRole.teamId),
    db
      .select({ teamId: integrationCredential.teamId, count: sql<number>`count(*)::int` })
      .from(integrationCredential)
      .where(inArray(integrationCredential.teamId, ids))
      .groupBy(integrationCredential.teamId),
    db
      .select({ teamId: aiAgent.teamId, count: sql<number>`count(*)::int` })
      .from(aiAgent)
      .where(inArray(aiAgent.teamId, ids))
      .groupBy(aiAgent.teamId),
    db
      .select({ teamId: agentSkill.teamId, count: sql<number>`count(*)::int` })
      .from(agentSkill)
      .where(inArray(agentSkill.teamId, ids))
      .groupBy(agentSkill.teamId),
    db
      .select({ teamId: agentTool.teamId, count: sql<number>`count(*)::int` })
      .from(agentTool)
      .where(inArray(agentTool.teamId, ids))
      .groupBy(agentTool.teamId),
  ]);
  const projects = new Map(projectCounts.map((r) => [r.teamId, r]));
  const members = new Map(memberCounts.map((r) => [r.teamId, r]));
  const roles = new Map(roleCounts.map((r) => [r.teamId, r.count]));
  const integrations = new Map(integrationCounts.map((r) => [r.teamId, r.count]));
  const agents = new Map(agentCounts.map((r) => [r.teamId, r.count]));
  const skills = new Map(skillCounts.map((r) => [r.teamId, r.count]));
  const tools = new Map(toolCounts.map((r) => [r.teamId, r.count]));

  return rows.map((row) => {
    const standing = row.role as TeamStanding;
    const projectCount = projects.get(row.id);
    return {
      id: row.id,
      name: row.name,
      mcpEnabled: row.mcpEnabled,
      role: standing,
      source: row.source as MemberSource,
      joinedAt: iso(row.joinedAt),
      projectCount: (runsTeam(standing) ? projectCount?.count : projectCount?.joined) ?? 0,
      memberCount: members.get(row.id)?.count ?? 0,
      ownerCount: members.get(row.id)?.owners ?? 0,
      roleCount: roles.get(row.id) ?? 0,
      integrationCount: integrations.get(row.id) ?? 0,
      agentCount: agents.get(row.id) ?? 0,
      skillCount: skills.get(row.id) ?? 0,
      toolCount: tools.get(row.id) ?? 0,
      createdAt: iso(row.createdAt),
    };
  });
}

// The teams the user belongs to. mcpOnly drops the ones with MCP switched off, so an
// MCP caller only sees the teams it can act in.
export async function listTeams(
  userId: string,
  opts: { mcpOnly?: boolean } = {},
): Promise<TeamRow[]> {
  const rows = await loadTeamRows(userId);
  return opts.mcpOnly ? rows.filter((row) => row.mcpEnabled) : rows;
}

// The team's MCP switch alone, for the guard that runs on every team-scoped MCP call.
export async function teamMcpEnabled(teamId: number): Promise<boolean> {
  const [row] = await db
    .select({ mcpEnabled: team.mcpEnabled })
    .from(team)
    .where(eq(team.id, teamId));
  return row?.mcpEnabled ?? false;
}

// The team's MCP settings: the switch, and which of its projects it covers. Both are
// written from the team's MCP section — a project does not open itself.
export interface TeamMcpSettings {
  enabled: boolean;
  projects: { projectId: number; enabled: boolean }[];
}

async function getTeamMcp(teamId: number): Promise<TeamMcpSettings> {
  const [rows, projects] = await Promise.all([
    db.select({ mcpEnabled: team.mcpEnabled }).from(team).where(eq(team.id, teamId)),
    db
      .select({ projectId: project.id, enabled: project.mcpEnabled })
      .from(project)
      .where(eq(project.teamId, teamId))
      .orderBy(project.key),
  ]);
  return { enabled: rows[0]?.mcpEnabled ?? false, projects };
}

// Applies a patch to the team's MCP settings and returns the result. A project of
// another team is ignored rather than written, so an id from elsewhere changes
// nothing.
export async function setTeamMcp(
  teamId: number,
  patch: { enabled?: boolean; projects?: { projectId: number; enabled: boolean }[] },
): Promise<TeamMcpSettings> {
  if (patch.enabled !== undefined) {
    await db.update(team).set({ mcpEnabled: patch.enabled }).where(eq(team.id, teamId));
  }
  // Written as one statement per value rather than one per project, so a whole set
  // of checkboxes costs two.
  for (const enabled of [true, false]) {
    const ids = (patch.projects ?? []).filter((p) => p.enabled === enabled).map((p) => p.projectId);
    if (ids.length === 0) continue;
    await db
      .update(project)
      .set({ mcpEnabled: enabled })
      .where(and(eq(project.teamId, teamId), inArray(project.id, ids)));
  }
  return getTeamMcp(teamId);
}

export async function getTeamMembership(
  teamId: number,
  userId: string,
): Promise<TeamStanding | null> {
  const rows = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  return rows[0] ? (rows[0].role as TeamStanding) : null;
}

// The team itself: the row the list carries, with what the caller may do with the
// resources it holds. Its members and its projects are read separately, one request
// per section of the page. Returns null when the caller is not a member of it.
export async function getTeam(teamId: number, userId: string): Promise<TeamDetail | null> {
  const [row] = await loadTeamRows(userId, teamId);
  if (!row) return null;

  const [permissions, leads] = await Promise.all([
    runsTeam(row.role) ? fullPermissions() : getTeamPermissions(teamId, userId),
    listTeamLeads(teamId),
  ]);
  return { ...row, permissions, leads };
}

// The owners and the managers of the team, owners first, then by name. Agents are left
// out: an agent's standing grants nothing, so it runs no team.
async function listTeamLeads(teamId: number): Promise<TeamLeadRow[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: teamMember.role,
    })
    .from(teamMember)
    .innerJoin(user, eq(user.id, teamMember.userId))
    .leftJoin(aiAgent, eq(aiAgent.userId, teamMember.userId))
    .where(
      and(
        eq(teamMember.teamId, teamId),
        inArray(teamMember.role, ['owner', 'manager']),
        isNull(aiAgent.id),
      ),
    )
    .orderBy(desc(eq(teamMember.role, 'owner')), user.name);
  return rows.map((r) => ({ ...r, role: r.role as 'owner' | 'manager' }));
}

// One page of the team's members, people and agents alike, by name. The search and the
// window run in the database, so a team with many members is never loaded whole.
export async function listTeamMembers(
  teamId: number,
  options: MemberFilters & { limit: number; offset: number },
): Promise<TeamMemberPage> {
  const where = and(eq(teamMember.teamId, teamId), matchesFilters(options));
  const [rows, counted] = await Promise.all([
    db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: teamMember.role,
        source: teamMember.source,
        agentId: aiAgent.id,
        username: aiAgent.username,
        joinedAt: teamMember.createdAt,
      })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .leftJoin(aiAgent, eq(aiAgent.userId, teamMember.userId))
      .where(where)
      .orderBy(user.name)
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .leftJoin(aiAgent, eq(aiAgent.userId, teamMember.userId))
      .where(where),
  ]);

  return {
    items: rows.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      role: m.role as TeamStanding,
      source: m.source as MemberSource,
      agentId: m.agentId,
      username: m.username,
      joinedAt: iso(m.joinedAt),
    })),
    total: counted[0]?.count ?? 0,
  };
}

// The projects of the team a caller reads: owners and managers see every one of them,
// everyone else only the ones they joined. The search matches the key or the name.
function visibleTeamProjects(
  teamId: number,
  userId: string,
  standing: TeamStanding,
  search?: string,
) {
  const term = search?.trim();
  return and(
    eq(project.teamId, teamId),
    runsTeam(standing)
      ? undefined
      : sql`exists (select 1 from ${projectMember} where ${projectMember.projectId} = ${project.id}
      and ${projectMember.userId} = ${userId})`,
    term ? or(ilike(project.key, `%${term}%`), ilike(project.name, `%${term}%`)) : undefined,
  );
}

// One page of the projects the team owns, with the caller's own access to each. The
// window runs in the database, so a team with many projects is never loaded whole;
// the owners are read for the page, not for every project.
export async function listTeamProjects(
  teamId: number,
  userId: string,
  standing: TeamStanding,
  options: { search?: string; limit: number; offset: number },
): Promise<TeamProjectPage> {
  const where = visibleTeamProjects(teamId, userId, standing, options.search);
  const [projects, counted] = await Promise.all([
    db
      .select({
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        mcpEnabled: project.mcpEnabled,
        createdAt: project.createdAt,
        memberCount: sql<number>`count(${projectMember.userId})::int`,
        isMember: sql<boolean>`bool_or(${projectMember.userId} = ${userId})`,
      })
      .from(project)
      .leftJoin(projectMember, eq(projectMember.projectId, project.id))
      .where(where)
      .groupBy(project.id)
      .orderBy(project.key)
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(project)
      .where(where),
  ]);

  const projectOwners = projects.length
    ? await db
        .select({
          projectId: projectMember.projectId,
          userId: user.id,
          name: user.name,
          image: user.image,
        })
        .from(projectMember)
        .innerJoin(user, eq(user.id, projectMember.userId))
        .where(
          and(
            inArray(
              projectMember.projectId,
              projects.map((p) => p.id),
            ),
            eq(projectMember.role, 'owner'),
          ),
        )
        .orderBy(user.name)
    : [];

  const ownersByProject = new Map<number, TeamProjectRow['owners']>();
  for (const o of projectOwners) {
    const owners = ownersByProject.get(o.projectId) ?? [];
    owners.push({ userId: o.userId, name: o.name, image: o.image });
    ownersByProject.set(o.projectId, owners);
  }

  return {
    items: projects.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      mcpEnabled: p.mcpEnabled,
      memberCount: p.memberCount,
      owners: ownersByProject.get(p.id) ?? [],
      isMember: p.isMember ?? false,
      createdAt: iso(p.createdAt),
    })),
    total: counted[0]?.count ?? 0,
  };
}

// Every project the caller reads, as id, key, name and MCP reach: the picker on an
// agent and the team's MCP switches, which need them all rather than a page.
export async function listTeamProjectOptions(
  teamId: number,
  userId: string,
  standing: TeamStanding,
): Promise<TeamProjectOption[]> {
  return db
    .select({
      id: project.id,
      key: project.key,
      name: project.name,
      mcpEnabled: project.mcpEnabled,
    })
    .from(project)
    .where(visibleTeamProjects(teamId, userId, standing))
    .orderBy(project.key);
}

// When the project's issue feed last moved. Read as the newest row rather than a
// max(), which the driver returns as a formatted string instead of a Date.
async function lastActivityAt(projectId: number): Promise<string | null> {
  const rows = await db
    .select({ createdAt: issueActivity.createdAt })
    .from(issueActivity)
    .innerJoin(issue, eq(issue.id, issueActivity.issueId))
    .where(eq(issue.projectId, projectId))
    .orderBy(desc(issueActivity.createdAt))
    .limit(1);
  return rows[0] ? iso(rows[0].createdAt) : null;
}

// Whether the project is one the team owns. The team-scoped project routes check it
// so a project of another team answers 404 rather than being acted on.
export async function teamOwnsProject(teamId: number, projectId: number): Promise<boolean> {
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.teamId, teamId)));
  return rows.length > 0;
}

// One project the team owns, with its issue stats and the reader's standing in it.
// Returns null when the project is not owned by the team, and when the caller
// neither runs the team nor belongs to the project, so the route answers 404 in both
// cases.
export async function getTeamProject(
  teamId: number,
  projectId: number,
  userId: string,
  standing: TeamStanding,
): Promise<TeamProjectDetail | null> {
  if (!(await teamOwnsProject(teamId, projectId))) return null;

  const viewer = await getMemberContext(projectId, userId);
  if (!runsTeam(standing) && !viewer) return null;

  const [activity, stats, source] = await Promise.all([
    lastActivityAt(projectId),
    getStats(projectId),
    getMembershipSource(projectId, userId),
  ]);

  return {
    lastActivityAt: activity,
    stats,
    viewer: viewer
      ? { role: viewer.role, source: source ?? 'invite', permissions: viewer.permissions }
      : null,
  };
}

// One page of a project's members, owners first and the rest newest membership
// first: who runs the project is the first thing the list has to answer. Returns
// null under the same two conditions getTeamProject does.
export async function listTeamProjectMembers(
  teamId: number,
  projectId: number,
  userId: string,
  standing: TeamStanding,
  options: MemberFilters & { limit: number; offset: number },
): Promise<TeamProjectMemberPage | null> {
  if (!(await teamOwnsProject(teamId, projectId))) return null;
  if (!runsTeam(standing) && !(await getMembership(projectId, userId))) return null;

  const { items, total } = await listMembersPage(projectId, { ...options, order: 'owners' });

  return {
    items: items.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      username: m.username,
      image: m.image,
      isAgent: m.isAgent,
      role: m.role,
      roleId: m.roleId,
      roleName: m.roleName,
      description: m.description,
      source: m.source,
      timezone: m.timezone,
      joinedAt: m.createdAt,
    })),
    total,
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Writes a team owned by one account, with the default role its projects assign. Every
// account owns one; the sign-up hook in @repo/auth writes the same rows inline, since
// it runs inside better-auth rather than through this module.
export async function insertOwnedTeam(tx: Transaction, name: string, ownerId: string) {
  const [row] = await tx.insert(team).values({ name }).returning();
  const [membership] = await tx
    .insert(teamMember)
    .values({ teamId: row.id, userId: ownerId, role: 'owner' })
    .returning();
  await tx.insert(teamRole).values({
    teamId: row.id,
    name: 'Member',
    isDefault: true,
    permissions: defaultMemberPermissions(),
  });
  return { team: row, membership };
}

// How many teams this account owns, which is what the team ceiling counts.
async function countOwnedTeams(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teamMember)
    .where(and(eq(teamMember.userId, ownerId), eq(teamMember.role, 'owner')));
  return row?.count ?? 0;
}

// The people in the team, which is what a seat ceiling counts. An agent's bot user sits
// in the member list but takes no seat.
export async function listTeamMemberIds(teamId: number): Promise<string[]> {
  const rows = await db
    .select({ userId: teamMember.userId })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), sql`${teamMember.role} <> 'agent'`));
  return rows.map((row) => row.userId);
}

// Refuses one more person in the team. Called wherever a membership is added for
// somebody who is not in it yet.
export async function assertTeamSeatFree(teamId: number): Promise<void> {
  const { maxTeamMembers } = await getLimits({ teamId });
  if (maxTeamMembers === 0) return;
  if ((await listTeamMemberIds(teamId)).length >= maxTeamMembers) {
    throw new HttpError(409, `The team is full at ${maxTeamMembers} members`);
  }
}

// The team an account gets at sign-up is written by the hook in @repo/auth, which does
// not come through here — the ceiling applies to the teams created on top of that one.
export async function createTeam(name: string, ownerId: string): Promise<TeamRow> {
  const { maxTeams } = await getLimits({ ownerUserId: ownerId });
  if (maxTeams > 0 && (await countOwnedTeams(ownerId)) >= maxTeams) {
    throw new HttpError(409, `You already own ${maxTeams} teams`);
  }
  return db.transaction(async (tx) => {
    const { team: row, membership } = await insertOwnedTeam(tx, name, ownerId);
    return {
      id: row.id,
      name: row.name,
      mcpEnabled: row.mcpEnabled,
      role: 'owner',
      source: 'invite',
      joinedAt: iso(membership.createdAt),
      projectCount: 0,
      memberCount: 1,
      ownerCount: 1,
      roleCount: 1,
      integrationCount: 0,
      agentCount: 0,
      skillCount: 0,
      toolCount: 0,
      createdAt: iso(row.createdAt),
    };
  });
}

export async function renameTeam(teamId: number, name: string, userId: string): Promise<TeamRow> {
  await db.update(team).set({ name }).where(eq(team.id, teamId));
  const [row] = await loadTeamRows(userId, teamId);
  return row;
}

async function membershipInTransaction(
  tx: Transaction,
  teamId: number,
  userId: string,
): Promise<TeamStanding | null> {
  const [row] = await tx
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  return row ? (row.role as TeamStanding) : null;
}

// Changes what a member ranks as in the team. An agent's standing comes from its
// agent settings, and nobody sets their own rank. Only an owner grants the owner rank
// or changes what another owner holds, which is also what keeps the last owner in
// place: demoting an owner takes a second one.
export async function setTeamMemberRole(
  teamId: number,
  actor: { userId: string; role: TeamStanding },
  userId: string,
  role: TeamRole,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.select({ id: team.id }).from(team).where(eq(team.id, teamId)).for('update');
    const actorRole = await membershipInTransaction(tx, teamId, actor.userId);
    if (!runsTeam(actorRole))
      throw new HttpError(403, 'Only a team owner or manager can change ranks');
    if (userId === actor.userId) throw new HttpError(409, 'You cannot change your own rank');
    const current = await membershipInTransaction(tx, teamId, userId);
    if (!current) throw new HttpError(404, 'Member not found');
    if (current === 'agent')
      throw new HttpError(409, "An agent's rank comes from its agent settings");
    if (actorRole !== 'owner' && (role === 'owner' || current === 'owner')) {
      throw new HttpError(403, 'Only a team owner can grant or take the owner rank');
    }
    await tx
      .update(teamMember)
      .set({ role })
      .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  });
}

// Refuses to end a membership that would leave a project of the team without an owner:
// ending it takes the member's project memberships with it, and the project's own member
// routes refuse such a removal for the same reason. The other owner has to be named
// first, from the project's member list.
async function assertLeavesNoProjectOwnerless(
  tx: Transaction,
  teamId: number,
  userId: string,
  subject: 'You' | 'They',
): Promise<void> {
  const soleOwned = await tx
    .select({ key: project.key })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .where(
      and(
        eq(project.teamId, teamId),
        eq(projectMember.userId, userId),
        eq(projectMember.role, 'owner'),
        sql`(select count(*) from ${projectMember} o where o.project_id = ${project.id} and o.role = 'owner') = 1`,
      ),
    )
    .orderBy(project.key);
  if (soleOwned.length === 0) return;

  const keys = soleOwned.map((r) => r.key).join(', ');
  throw new HttpError(
    409,
    `${subject} are the only owner of ${keys}. Give each one another owner first.`,
  );
}

// Ends a team membership: the member leaves the team and every project it owns. What
// they already did in those projects stays — issues keep their assignee and their
// author.
async function dropTeamMembership(tx: Transaction, teamId: number, userId: string): Promise<void> {
  const teamProjects = tx
    .select({ id: project.id })
    .from(project)
    .where(eq(project.teamId, teamId));
  await tx
    .delete(projectMember)
    .where(and(eq(projectMember.userId, userId), inArray(projectMember.projectId, teamProjects)));
  // A column cannot keep assigning issues to someone who no longer belongs to the
  // project, the same rule remove_member follows.
  await tx
    .update(projectColumn)
    .set({ autoAssignUserId: null })
    .where(
      and(
        eq(projectColumn.autoAssignUserId, userId),
        inArray(projectColumn.projectId, teamProjects),
      ),
    );
  await tx
    .delete(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
}

// A membership the SCIM group reconciliation owns ends at the identity provider: the
// next sync would put it back, and dropping it here would take the project memberships
// that same sync granted with it. Only the plain member rows it writes — a rank raised
// by hand is the team's, and the reconciliation leaves those alone too.
async function assertNotProvisioned(
  tx: Transaction,
  teamId: number,
  userId: string,
): Promise<void> {
  const [row] = await tx
    .select({ role: teamMember.role, source: teamMember.source })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  if (row?.source === 'scim' && row.role === 'member') {
    throw new HttpError(409, 'This membership is managed by SCIM');
  }
}

// Removes a member from the team. Nobody removes themselves — that is leaving the
// team. Removing an owner is possible because the actor is one and stays, so the team
// never loses its last owner.
export async function removeTeamMember(
  teamId: number,
  actorId: string,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.select({ id: team.id }).from(team).where(eq(team.id, teamId)).for('update');
    if ((await membershipInTransaction(tx, teamId, actorId)) !== 'owner') {
      throw new HttpError(403, 'Only a team owner can remove members');
    }
    if (userId === actorId) throw new HttpError(409, 'Leave the team instead of removing yourself');
    const current = await membershipInTransaction(tx, teamId, userId);
    if (!current) throw new HttpError(404, 'Member not found');
    if (current === 'agent')
      throw new HttpError(409, 'An agent is removed with its agent settings');
    await assertNotProvisioned(tx, teamId, userId);
    await assertLeavesNoProjectOwnerless(tx, teamId, userId, 'They');
    await dropTeamMembership(tx, teamId, userId);
  });
}

// Drops the caller's own membership, with their access to the team's projects. The
// team keeps the projects themselves. The last owner cannot leave: a team without an
// owner has nobody who can rename it. Neither can the only owner of one of its
// projects, for the same reason one project down. An agent cannot either: its standing
// is written with the agent and nothing puts it back, so leaving would strand it.
export async function leaveTeam(teamId: number, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.select({ id: team.id }).from(team).where(eq(team.id, teamId)).for('update');
    const role = await membershipInTransaction(tx, teamId, userId);
    if (!role) throw new HttpError(404, 'Member not found');
    if (role === 'agent') throw new HttpError(409, 'An agent is removed with its agent settings');
    if (role === 'owner') {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(teamMember)
        .where(and(eq(teamMember.teamId, teamId), eq(teamMember.role, 'owner')));
      if (count === 1) throw new HttpError(409, 'The last owner cannot leave the team');
    }
    await assertNotProvisioned(tx, teamId, userId);
    await assertLeavesNoProjectOwnerless(tx, teamId, userId, 'You');
    await dropTeamMembership(tx, teamId, userId);
  });
}
