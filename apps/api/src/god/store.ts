import {
  db,
  user,
  session,
  account,
  agentSkill,
  agentTool,
  aiAgent,
  initiative,
  integrationCredential,
  issue,
  issueActivity,
  project,
  projectDashboard,
  projectMember,
  projectRole,
  projectView,
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
import { iso } from '../shared/lib';
import {
  defaultMemberPermissions,
  fullPermissions,
  normalizePermissions,
  type Permissions,
} from '../shared/permissions';

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
        roleName: projectRole.name,
        permissions: projectRole.permissions,
        joinedAt: projectMember.createdAt,
      })
      .from(projectMember)
      .innerJoin(project, eq(project.id, projectMember.projectId))
      .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
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
  await db.delete(user).where(eq(user.id, userId));
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
  integrationCount: number;
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
  image: string | null;
  isAgent: boolean;
  role: 'owner' | 'member';
  roleId: number | null;
  roleName: string | null;
  permissions: Permissions;
  joinedAt: string;
}

export interface InstanceProjectDetail extends InstanceProjectRow {
  members: InstanceProjectMember[];
}

export interface InstanceProjectPage {
  items: InstanceProjectRow[];
  // How many projects match the search, ignoring the page window.
  total: number;
}

// How many rows each of the given projects has in a project-scoped table.
async function countByProject(
  table: PgTable,
  projectIdColumn: AnyPgColumn,
  projectIds: number[],
  extra?: SQL,
): Promise<Map<number, number>> {
  const rows = await db
    .select({ projectId: projectIdColumn, count: sql<number>`count(*)::int` })
    .from(table)
    .where(and(inArray(projectIdColumn, projectIds), extra))
    .groupBy(projectIdColumn);
  return new Map(rows.map((r) => [r.projectId as number, r.count]));
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
  integrationCount: 0,
  lastActivityAt: null,
};

// The counts and the last feed entry for the given projects, each in one grouped
// query and joined in memory, so the project query stays a plain select.
async function loadProjectFacts(projectIds: number[]): Promise<(id: number) => ProjectFacts> {
  if (projectIds.length === 0) return () => EMPTY_FACTS;
  const counts = (map: Map<number, number>, id: number) => map.get(id) ?? 0;

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
    integrations,
    activityRows,
  ] = await Promise.all([
    countByProject(projectMember, projectMember.projectId, projectIds),
    countByProject(issue, issue.projectId, projectIds, isNull(issue.archivedAt)),
    countByProject(issue, issue.projectId, projectIds, isNotNull(issue.archivedAt)),
    countByProject(initiative, initiative.projectId, projectIds),
    countByProject(projectDashboard, projectDashboard.projectId, projectIds),
    countByProject(projectView, projectView.projectId, projectIds),
    countByProject(aiAgent, aiAgent.projectId, projectIds),
    countByProject(agentSkill, agentSkill.projectId, projectIds),
    countByProject(agentTool, agentTool.projectId, projectIds),
    countByProject(integrationCredential, integrationCredential.projectId, projectIds),
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
      memberCount: counts(members, id),
      issueCount: counts(issues, id),
      archivedIssueCount: counts(archivedIssues, id),
      initiativeCount: counts(initiatives, id),
      dashboardCount: counts(dashboards, id),
      viewCount: counts(views, id),
      agentCount: counts(agents, id),
      skillCount: counts(skills, id),
      toolCount: counts(tools, id),
      integrationCount: counts(integrations, id),
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

// One project with its members and the access each membership resolves to. Returns
// null for an unknown id.
export async function getInstanceProject(projectId: number): Promise<InstanceProjectDetail | null> {
  const rows = await db.select().from(project).where(eq(project.id, projectId));
  const row = rows[0];
  if (!row) return null;

  const [facts, memberships, agentRows] = await Promise.all([
    loadProjectFacts([row.id]),
    db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: projectMember.role,
        roleId: projectMember.roleId,
        roleName: projectRole.name,
        permissions: projectRole.permissions,
        joinedAt: projectMember.createdAt,
      })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
      .where(eq(projectMember.projectId, projectId))
      .orderBy(user.name),
    db.select({ userId: aiAgent.userId }).from(aiAgent).where(eq(aiAgent.projectId, projectId)),
  ]);

  const agentUserIds = new Set(agentRows.map((r) => r.userId));
  const members: InstanceProjectMember[] = memberships.map((m) => {
    const role = m.role === 'owner' ? 'owner' : 'member';
    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      isAgent: agentUserIds.has(m.userId),
      role,
      roleId: m.roleId,
      roleName: m.roleName,
      permissions: resolvePermissions(role, m.permissions),
      joinedAt: iso(m.joinedAt),
    };
  });

  return { ...toProjectRow(row, facts(row.id)), members };
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
