import {
  db,
  user,
  session,
  account,
  agentSkill,
  agentTool,
  aiAgent,
  initiative,
  issue,
  issueActivity,
  project,
  projectDashboard,
  projectMember,
  team,
  teamMember,
  teamRole,
  projectView,
  scimGroup,
  scimGroupMapping,
  scimGroupMember,
} from '@repo/db';
import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { HttpError, iso } from '#shared/lib';
import { deleteAccount } from '#shared/account-deletion';
import { mappedProjectIds, reconcileProjects } from '#modules/scim/reconcile';
import {
  defaultMemberPermissions,
  fullPermissions,
  normalizePermissions,
  type Permissions,
} from '#shared/permissions';
import { listAllMembers, listMemberContexts } from '#modules/members/service';
import { listRoles } from '#modules/roles/service';
import type { TeamStanding } from '#modules/teams/service';

// Data access for the instance directories (god mode): every account and every
// project on this instance. It reads across the better-auth tables (user, session,
// account) and across projects the caller is not a member of, which no
// project-scoped store may do — every function here is behind the god guard.

export interface InstanceUserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  // The global better-auth role: "god" for the instance owner, "user" otherwise.
  role: string;
  // True when this user is an AI agent's bot user. Agents are created on a
  // project's AI Agents screen, not by signing up.
  isAgent: boolean;
  // The sign-in methods linked to the account ("credential", "google", …).
  providers: string[];
  projectCount: number;
  // The start of the most recent session, or null when the user never signed in.
  lastSeenAt: string | null;
  createdAt: string;
}

// A project the user can reach, with the access their membership resolves to.
export interface InstanceUserProject {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
  roleName: string | null;
  // The effective matrix: full for an owner, the assigned role's matrix for a
  // member, the default member matrix when no role is assigned.
  permissions: Permissions;
  // How many owners the project has. 1 on a project this user owns means deleting
  // the account would leave the project with nobody who can manage it.
  ownerCount: number;
  joinedAt: string;
}

export interface InstanceUserDetail extends InstanceUserRow {
  projects: InstanceUserProject[];
}

type UserRow = typeof user.$inferSelect;

// The effective matrix of a membership: full for an owner, the assigned role's
// matrix for a member, the default member matrix when no role is assigned.
function resolvePermissions(role: 'owner' | 'member', rolePermissions: unknown): Permissions {
  if (role === 'owner') return fullPermissions();
  if (!rolePermissions) return defaultMemberPermissions();
  return normalizePermissions(rolePermissions);
}

// The per-user facts that live in other tables. Collected in one grouped query
// each and joined in memory, so the user query stays a plain select.
interface UserFacts {
  agents: Set<string>;
  providers: Map<string, string[]>;
  projectCounts: Map<string, number>;
  lastSeen: Map<string, Date>;
}

async function loadUserFacts(userIds: string[]): Promise<UserFacts> {
  if (userIds.length === 0) {
    return {
      agents: new Set(),
      providers: new Map(),
      projectCounts: new Map(),
      lastSeen: new Map(),
    };
  }
  const [agentRows, accountRows, memberRows, sessionRows] = await Promise.all([
    db.select({ userId: aiAgent.userId }).from(aiAgent).where(inArray(aiAgent.userId, userIds)),
    db
      .select({ userId: account.userId, providerId: account.providerId })
      .from(account)
      .where(inArray(account.userId, userIds)),
    db
      .select({ userId: projectMember.userId, count: sql<number>`count(*)::int` })
      .from(projectMember)
      .where(inArray(projectMember.userId, userIds))
      .groupBy(projectMember.userId),
    // Session start times, reduced to the latest per user below. Aggregating in
    // SQL would return the max as a driver-formatted string, not a Date.
    db
      .select({ userId: session.userId, createdAt: session.createdAt })
      .from(session)
      .where(inArray(session.userId, userIds)),
  ]);

  const providers = new Map<string, string[]>();
  for (const r of accountRows) {
    const list = providers.get(r.userId) ?? [];
    if (!list.includes(r.providerId)) list.push(r.providerId);
    providers.set(r.userId, list);
  }

  const lastSeen = new Map<string, Date>();
  for (const r of sessionRows) {
    const current = lastSeen.get(r.userId);
    if (!current || r.createdAt > current) lastSeen.set(r.userId, r.createdAt);
  }

  return {
    agents: new Set(agentRows.map((r) => r.userId)),
    providers,
    projectCounts: new Map(memberRows.map((r) => [r.userId, r.count])),
    lastSeen,
  };
}

function toRow(r: UserRow, facts: UserFacts): InstanceUserRow {
  const lastSeen = facts.lastSeen.get(r.id) ?? null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    image: r.image,
    emailVerified: r.emailVerified,
    role: r.role ?? 'user',
    isAgent: facts.agents.has(r.id),
    providers: facts.providers.get(r.id) ?? [],
    projectCount: facts.projectCounts.get(r.id) ?? 0,
    lastSeenAt: lastSeen ? iso(lastSeen) : null,
    createdAt: iso(r.createdAt),
  };
}

export interface InstanceUserPage {
  items: InstanceUserRow[];
  // How many accounts match the filters, ignoring the page window.
  total: number;
}

// Which accounts the directory lists: real people, the bot users behind AI agents,
// or both.
export const USER_KINDS = ['human', 'agent', 'all'] as const;
export type UserKind = (typeof USER_KINDS)[number];

// One page of accounts, newest first. `search` matches the name or the email;
// `kind` narrows to people or agent bot users. Both filters run in SQL, so the page
// window and the total count agree.
export async function listInstanceUsers(options: {
  search?: string;
  kind: UserKind;
  limit: number;
  offset: number;
}): Promise<InstanceUserPage> {
  const term = options.search?.trim();
  const isAgent = db
    .select({ n: sql`1` })
    .from(aiAgent)
    .where(eq(aiAgent.userId, user.id));
  const where = and(
    term ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`)) : undefined,
    options.kind === 'human'
      ? notExists(isAgent)
      : options.kind === 'agent'
        ? exists(isAgent)
        : undefined,
  );

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(where),
  ]);

  const facts = await loadUserFacts(rows.map((r) => r.id));
  return { items: rows.map((r) => toRow(r, facts)), total: totals[0]?.count ?? 0 };
}

// One account with the projects it can reach. Returns null for an unknown id.
export async function getInstanceUser(userId: string): Promise<InstanceUserDetail | null> {
  const rows = await db.select().from(user).where(eq(user.id, userId));
  const row = rows[0];
  if (!row) return null;

  const [facts, memberships] = await Promise.all([
    loadUserFacts([row.id]),
    db
      .select({
        projectId: project.id,
        projectKey: project.key,
        projectName: project.name,
        role: projectMember.role,
        roleId: projectMember.roleId,
        roleName: teamRole.name,
        permissions: teamRole.permissions,
        joinedAt: projectMember.createdAt,
      })
      .from(projectMember)
      .innerJoin(project, eq(project.id, projectMember.projectId))
      .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
      .where(eq(projectMember.userId, userId))
      .orderBy(project.name),
  ]);

  const ownerCounts = await countOwnersByProject(memberships.map((m) => m.projectId));

  const projects: InstanceUserProject[] = memberships.map((m) => {
    const role = m.role === 'owner' ? 'owner' : 'member';
    return {
      projectId: m.projectId,
      projectKey: m.projectKey,
      projectName: m.projectName,
      role,
      roleId: m.roleId,
      roleName: m.roleName,
      ownerCount: ownerCounts.get(m.projectId) ?? 0,
      permissions: resolvePermissions(role, m.permissions),
      joinedAt: iso(m.joinedAt),
    };
  });

  return { ...toRow(row, facts), projects };
}

// How many owners each of the given projects has, keyed by project id.
async function countOwnersByProject(projectIds: number[]): Promise<Map<number, number>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db
    .select({ projectId: projectMember.projectId, count: sql<number>`count(*)::int` })
    .from(projectMember)
    .where(and(eq(projectMember.role, 'owner'), inArray(projectMember.projectId, projectIds)))
    .groupBy(projectMember.projectId);
  return new Map(rows.map((r) => [r.projectId, r.count]));
}

// Removes the account. Every table that points at a user either cascades (its
// sessions, accounts, memberships, notifications, preferences) or sets the
// reference to null (assignee, activity actor, invites), so this is a single
// delete.
export async function deleteInstanceUser(userId: string): Promise<void> {
  await deleteAccount(userId);
}

// ── Project directory ────────────────────────────────────────────────────────

// What a project holds, counted across its dependent tables. Read for the list and
// the detail alike, so a row in the directory already carries everything.
export interface InstanceProjectCounts {
  memberCount: number;
  issueCount: number;
  archivedIssueCount: number;
  initiativeCount: number;
  dashboardCount: number;
  viewCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
}

export interface InstanceProjectRow extends InstanceProjectCounts {
  id: number;
  key: string;
  name: string;
  description: string;
  mcpEnabled: boolean;
  // The most recent entry in the project's issue feed, or null when nothing has
  // happened in it yet.
  lastActivityAt: string | null;
  createdAt: string;
}

// One member of the project, with the access their membership resolves to. The
// mirror of InstanceUserProject: same facts, read from the project's side.
export interface InstanceProjectMember {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. An agent's bot user carries the
  // agent's handle, not one of its own.
  username: string | null;
  image: string | null;
  isAgent: boolean;
  role: 'owner' | 'member';
  roleId: number | null;
  roleName: string | null;
  permissions: Permissions;
  description: string;
  timezone: string;
  joinedAt: string;
}

export interface InstanceProjectDetail extends InstanceProjectRow {
  members: InstanceProjectMember[];
  // The custom roles a member of this project can be put on. Read by the SCIM group
  // mapping form, which names one when a group grants membership.
  roles: { id: number; name: string; isDefault: boolean }[];
}

export interface InstanceProjectPage {
  items: InstanceProjectRow[];
  // How many projects match the search, ignoring the page window.
  total: number;
}

// How many rows each of the given projects can draw on in a team-scoped table (the
// skill library, the configured tools): they belong to the team that owns the project,
// so two projects of one team report the same number.
async function countByTeamOfProject(
  table: PgTable,
  teamIdColumn: AnyPgColumn,
  projectIds: number[],
): Promise<Map<number, number>> {
  const rows = await db
    .select({ projectId: project.id, count: sql<number>`count(${teamIdColumn})::int` })
    .from(project)
    .leftJoin(table, eq(teamIdColumn, project.teamId))
    .where(inArray(project.id, projectIds))
    .groupBy(project.id);
  return new Map(rows.map((r) => [r.projectId, r.count]));
}

const countAt = (counts: Map<number, number>, id: number) => counts.get(id) ?? 0;

// How many rows each of the given owners has in a table that points at them, keyed by
// the owner id: a project-scoped table by project, a team-scoped one by team.
async function countByOwner(
  table: PgTable,
  ownerIdColumn: AnyPgColumn,
  ownerIds: number[],
  extra?: SQL,
): Promise<Map<number, number>> {
  const rows = await db
    .select({ ownerId: ownerIdColumn, count: sql<number>`count(*)::int` })
    .from(table)
    .where(and(inArray(ownerIdColumn, ownerIds), extra))
    .groupBy(ownerIdColumn);
  return new Map(rows.map((r) => [r.ownerId as number, r.count]));
}

type ProjectFacts = InstanceProjectCounts & { lastActivityAt: string | null };

const EMPTY_FACTS: ProjectFacts = {
  memberCount: 0,
  issueCount: 0,
  archivedIssueCount: 0,
  initiativeCount: 0,
  dashboardCount: 0,
  viewCount: 0,
  agentCount: 0,
  skillCount: 0,
  toolCount: 0,
  lastActivityAt: null,
};

// The counts and the last feed entry for the given projects, each in one grouped
// query and joined in memory, so the project query stays a plain select.
async function loadProjectFacts(projectIds: number[]): Promise<(id: number) => ProjectFacts> {
  if (projectIds.length === 0) return () => EMPTY_FACTS;

  const [
    members,
    issues,
    archivedIssues,
    initiatives,
    dashboards,
    views,
    agents,
    skills,
    tools,
    activityRows,
  ] = await Promise.all([
    countByOwner(projectMember, projectMember.projectId, projectIds),
    countByOwner(issue, issue.projectId, projectIds, isNull(issue.archivedAt)),
    countByOwner(issue, issue.projectId, projectIds, isNotNull(issue.archivedAt)),
    countByOwner(initiative, initiative.projectId, projectIds),
    countByOwner(projectDashboard, projectDashboard.projectId, projectIds),
    countByOwner(projectView, projectView.projectId, projectIds),
    // An agent belongs to a team and works in the projects it is a member of, so the
    // count per project is its memberships, not its own rows.
    countByOwner(
      projectMember,
      projectMember.projectId,
      projectIds,
      sql`exists (select 1 from ${aiAgent} where ${aiAgent.userId} = ${projectMember.userId})`,
    ),
    countByTeamOfProject(agentSkill, agentSkill.teamId, projectIds),
    countByTeamOfProject(agentTool, agentTool.teamId, projectIds),
    // The feed has no project column of its own; it reaches one through its issue.
    // Reduced to the latest per project below, because aggregating in SQL would
    // return the max as a driver-formatted string, not a Date.
    db
      .select({ projectId: issue.projectId, createdAt: issueActivity.createdAt })
      .from(issueActivity)
      .innerJoin(issue, eq(issue.id, issueActivity.issueId))
      .where(inArray(issue.projectId, projectIds)),
  ]);

  const lastActivity = new Map<number, Date>();
  for (const r of activityRows) {
    const current = lastActivity.get(r.projectId);
    if (!current || r.createdAt > current) lastActivity.set(r.projectId, r.createdAt);
  }

  return (id: number): ProjectFacts => {
    const activeAt = lastActivity.get(id);
    return {
      memberCount: countAt(members, id),
      issueCount: countAt(issues, id),
      archivedIssueCount: countAt(archivedIssues, id),
      initiativeCount: countAt(initiatives, id),
      dashboardCount: countAt(dashboards, id),
      viewCount: countAt(views, id),
      agentCount: countAt(agents, id),
      skillCount: countAt(skills, id),
      toolCount: countAt(tools, id),
      lastActivityAt: activeAt ? iso(activeAt) : null,
    };
  };
}

type ProjectRow = typeof project.$inferSelect;

function toProjectRow(r: ProjectRow, facts: ProjectFacts): InstanceProjectRow {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    mcpEnabled: r.mcpEnabled,
    createdAt: iso(r.createdAt),
    ...facts,
  };
}

// One page of projects, newest first. `search` matches the key or the name and runs
// in SQL, so the page window and the total count agree.
export async function listInstanceProjects(options: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<InstanceProjectPage> {
  const term = options.search?.trim();
  const where = term
    ? or(ilike(project.key, `%${term}%`), ilike(project.name, `%${term}%`))
    : undefined;

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(project)
      .where(where)
      .orderBy(desc(project.createdAt))
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(project)
      .where(where),
  ]);

  const facts = await loadProjectFacts(rows.map((r) => r.id));
  const items = rows.map((r) => toProjectRow(r, facts(r.id)));
  return { items, total: totals[0]?.count ?? 0 };
}

// Every project on the instance as a picker entry, by key. What the SCIM group
// mapping form fills its project select from.
export async function listInstanceProjectOptions(): Promise<
  { id: number; key: string; name: string }[]
> {
  return db
    .select({ id: project.id, key: project.key, name: project.name })
    .from(project)
    .orderBy(project.key);
}

// One project with its members and the access each membership resolves to. Returns
// null for an unknown id.
export async function getInstanceProject(projectId: number): Promise<InstanceProjectDetail | null> {
  const rows = await db.select().from(project).where(eq(project.id, projectId));
  const row = rows[0];
  if (!row) return null;

  const [facts, memberships, contexts, roles] = await Promise.all([
    loadProjectFacts([row.id]),
    listAllMembers(projectId),
    listMemberContexts(projectId),
    listRoles(row.teamId),
  ]);

  const members: InstanceProjectMember[] = memberships.flatMap((m) => {
    const context = contexts.get(m.userId);
    if (!context) return [];
    return [
      {
        userId: m.userId,
        name: m.name,
        email: m.email,
        username: m.username,
        image: m.image,
        isAgent: m.isAgent,
        role: m.role,
        roleId: m.roleId,
        roleName: m.roleName,
        permissions: context.permissions,
        description: m.description,
        timezone: m.timezone,
        joinedAt: m.createdAt,
      },
    ];
  });
  members.sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...toProjectRow(row, facts(row.id)),
    members,
    roles: roles.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault })),
  };
}

// ── Team directory ───────────────────────────────────────────────────────────

// What a team holds, counted across the tables it owns and the projects it owns.
// Read for the list and the detail alike, so a row in the directory already carries
// everything.
export interface InstanceTeamCounts {
  memberCount: number;
  projectCount: number;
  issueCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
  roleCount: number;
}

export interface InstanceTeamRow extends InstanceTeamCounts {
  id: number;
  name: string;
  mcpEnabled: boolean;
  createdAt: string;
}

export interface InstanceTeamProject {
  id: number;
  key: string;
  name: string;
  mcpEnabled: boolean;
  memberCount: number;
  issueCount: number;
  createdAt: string;
}

// One member of the team. The role is the fixed team rank, not a project role, and
// 'agent' is the bot user of an ai_agent.
export interface InstanceTeamMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isAgent: boolean;
  role: TeamStanding;
  joinedAt: string;
}

export interface InstanceTeamPage {
  items: InstanceTeamRow[];
  // How many teams match the search, ignoring the page window.
  total: number;
}

export interface InstanceTeamProjectPage {
  items: InstanceTeamProject[];
  total: number;
}

export interface InstanceTeamMemberPage {
  items: InstanceTeamMember[];
  total: number;
}

const EMPTY_TEAM_COUNTS: InstanceTeamCounts = {
  memberCount: 0,
  projectCount: 0,
  issueCount: 0,
  agentCount: 0,
  skillCount: 0,
  toolCount: 0,
  roleCount: 0,
};

// The counts for the given teams, each in one grouped query and joined in memory,
// so the team query stays a plain select.
async function loadTeamCounts(teamIds: number[]): Promise<(id: number) => InstanceTeamCounts> {
  if (teamIds.length === 0) return () => EMPTY_TEAM_COUNTS;

  const [members, projects, issues, agents, skills, tools, roles] = await Promise.all([
    countByOwner(teamMember, teamMember.teamId, teamIds),
    countByOwner(project, project.teamId, teamIds),
    // Issues have no team column; they reach one through their project.
    db
      .select({ teamId: project.teamId, count: sql<number>`count(*)::int` })
      .from(issue)
      .innerJoin(project, eq(project.id, issue.projectId))
      .where(and(inArray(project.teamId, teamIds), isNull(issue.archivedAt)))
      .groupBy(project.teamId)
      .then((rows) => new Map(rows.map((r) => [r.teamId, r.count]))),
    countByOwner(aiAgent, aiAgent.teamId, teamIds),
    countByOwner(agentSkill, agentSkill.teamId, teamIds),
    countByOwner(agentTool, agentTool.teamId, teamIds),
    countByOwner(teamRole, teamRole.teamId, teamIds),
  ]);

  return (id) => ({
    memberCount: countAt(members, id),
    projectCount: countAt(projects, id),
    issueCount: countAt(issues, id),
    agentCount: countAt(agents, id),
    skillCount: countAt(skills, id),
    toolCount: countAt(tools, id),
    roleCount: countAt(roles, id),
  });
}

type TeamRow = typeof team.$inferSelect;

function toTeamRow(r: TeamRow, counts: InstanceTeamCounts): InstanceTeamRow {
  return {
    id: r.id,
    name: r.name,
    mcpEnabled: r.mcpEnabled,
    createdAt: iso(r.createdAt),
    ...counts,
  };
}

// One page of teams, newest first. `search` matches the name and runs in SQL, so the
// page window and the total count agree.
export async function listInstanceTeams(options: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<InstanceTeamPage> {
  const term = options.search?.trim();
  const where = term ? ilike(team.name, `%${term}%`) : undefined;

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(team)
      .where(where)
      .orderBy(desc(team.createdAt))
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(team)
      .where(where),
  ]);

  const counts = await loadTeamCounts(rows.map((r) => r.id));
  return { items: rows.map((r) => toTeamRow(r, counts(r.id))), total: totals[0]?.count ?? 0 };
}

// One team with what it holds. Its projects and its members are their own paged
// routes, so a large team is never loaded whole. Returns null for an unknown id.
export async function getInstanceTeam(teamId: number): Promise<InstanceTeamRow | null> {
  const rows = await db.select().from(team).where(eq(team.id, teamId));
  const row = rows[0];
  if (!row) return null;

  const counts = await loadTeamCounts([row.id]);
  return toTeamRow(row, counts(row.id));
}

// One page of the projects a team owns, by key. `search` matches the key or the name.
export async function listInstanceTeamProjects(
  teamId: number,
  options: { search?: string; limit: number; offset: number },
): Promise<InstanceTeamProjectPage> {
  const term = options.search?.trim();
  const where = and(
    eq(project.teamId, teamId),
    term ? or(ilike(project.key, `%${term}%`), ilike(project.name, `%${term}%`)) : undefined,
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: project.id,
        key: project.key,
        name: project.name,
        mcpEnabled: project.mcpEnabled,
        createdAt: project.createdAt,
        memberCount: sql<number>`count(distinct ${projectMember.userId})::int`,
        issueCount: sql<number>`count(distinct ${issue.id})::int`,
      })
      .from(project)
      .leftJoin(projectMember, eq(projectMember.projectId, project.id))
      .leftJoin(issue, and(eq(issue.projectId, project.id), isNull(issue.archivedAt)))
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

  return {
    items: rows.map((p) => ({ ...p, createdAt: iso(p.createdAt) })),
    total: totals[0]?.count ?? 0,
  };
}

// One page of the team's members, people and agents alike, by name. `search` matches
// the name or the address.
export async function listInstanceTeamMembers(
  teamId: number,
  options: { search?: string; limit: number; offset: number },
): Promise<InstanceTeamMemberPage> {
  const term = options.search?.trim();
  const where = and(
    eq(teamMember.teamId, teamId),
    term ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`)) : undefined,
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        agentId: aiAgent.id,
        role: teamMember.role,
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
      .where(where),
  ]);

  return {
    items: rows.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      isAgent: m.agentId !== null,
      role: m.role as TeamStanding,
      joinedAt: iso(m.joinedAt),
    })),
    total: totals[0]?.count ?? 0,
  };
}

// Marks the account's email address as confirmed and returns the updated user.
// Returns null for an unknown id.
export async function verifyInstanceUserEmail(userId: string): Promise<InstanceUserDetail | null> {
  const updated = await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  if (updated.length === 0) return null;
  return getInstanceUser(userId);
}

// ── Provisioned groups ───────────────────────────────────────────────────────

// A group an identity provider pushed over SCIM, with what it grants. The group
// and its members belong to the provider and are read-only here; the mappings are
// the instance owner's, and are what turns group membership into project access.
export interface InstanceScimGroupMapping {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface InstanceScimGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  memberCount: number;
  mappings: InstanceScimGroupMapping[];
}

export async function listScimGroups(): Promise<InstanceScimGroup[]> {
  const [groups, counts, mappings] = await Promise.all([
    db.select().from(scimGroup).orderBy(scimGroup.displayName),
    db
      .select({ groupId: scimGroupMember.groupId, count: sql<number>`count(*)::int` })
      .from(scimGroupMember)
      .groupBy(scimGroupMember.groupId),
    db
      .select({
        groupId: scimGroupMapping.groupId,
        projectId: scimGroupMapping.projectId,
        projectKey: project.key,
        projectName: project.name,
        role: scimGroupMapping.role,
        roleId: scimGroupMapping.roleId,
      })
      .from(scimGroupMapping)
      .innerJoin(project, eq(project.id, scimGroupMapping.projectId))
      .orderBy(project.name),
  ]);

  const countByGroup = new Map(counts.map((row) => [row.groupId, row.count]));
  return groups.map((group) => ({
    id: group.id,
    displayName: group.displayName,
    externalId: group.externalId,
    memberCount: countByGroup.get(group.id) ?? 0,
    mappings: mappings
      .filter((m) => m.groupId === group.id)
      .map((m) => ({
        projectId: m.projectId,
        projectKey: m.projectKey,
        projectName: m.projectName,
        role: m.role === 'owner' ? ('owner' as const) : ('member' as const),
        roleId: m.roleId,
      })),
  }));
}

// Replaces what a group grants, then reconciles every project the change touched —
// the ones it granted before as well as the ones it grants now, so a project it was
// unmapped from loses the memberships that came from it.
export async function setScimGroupMappings(
  groupId: string,
  mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
): Promise<InstanceScimGroup> {
  const found = await db
    .select({ id: scimGroup.id })
    .from(scimGroup)
    .where(eq(scimGroup.id, groupId));
  if (!found[0]) throw new HttpError(404, 'Group not found');

  const projectIds = mappings.map((m) => m.projectId);
  if (new Set(projectIds).size !== projectIds.length) {
    throw new HttpError(400, 'A group can be mapped to a project only once');
  }
  if (projectIds.length > 0) {
    const known = await db
      .select({ id: project.id, teamId: project.teamId })
      .from(project)
      .where(inArray(project.id, projectIds));
    if (known.length !== new Set(projectIds).size) throw new HttpError(400, 'Unknown project');
    // A role belongs to one team, so a mapping that names another team's role would
    // silently grant the wrong permissions.
    const roleIds = mappings.map((m) => m.roleId).filter((id): id is number => id !== null);
    if (roleIds.length > 0) {
      const roles = await db
        .select({ id: teamRole.id, teamId: teamRole.teamId })
        .from(teamRole)
        .where(inArray(teamRole.id, roleIds));
      for (const mapping of mappings) {
        if (mapping.roleId === null) continue;
        const role = roles.find((r) => r.id === mapping.roleId);
        const teamId = known.find((p) => p.id === mapping.projectId)?.teamId;
        if (!role || role.teamId !== teamId) {
          throw new HttpError(400, 'The role does not belong to that project');
        }
      }
    }
  }

  const before = await mappedProjectIds(groupId);
  await db.transaction(async (tx) => {
    await tx.delete(scimGroupMapping).where(eq(scimGroupMapping.groupId, groupId));
    if (mappings.length > 0) {
      await tx.insert(scimGroupMapping).values(
        mappings.map((m) => ({
          groupId,
          projectId: m.projectId,
          role: m.role,
          // Owners bypass the permission matrix, so they carry no custom role.
          roleId: m.role === 'owner' ? null : m.roleId,
        })),
      );
    }
  });
  await reconcileProjects([...before, ...projectIds]);

  const groups = await listScimGroups();
  return groups.find((g) => g.id === groupId)!;
}
