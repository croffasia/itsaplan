import {
  db,
  project,
  scimGroup,
  scimGroupMapping,
  scimGroupMember,
  team,
  teamRole,
} from '@repo/db';
import { and, asc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import { workspacesWithOwnScim } from '@repo/auth';
import { HttpError } from '#shared/lib';
import { mappedProjectIds, reconcileProjects } from './reconcile';
import { ofProvider } from './service';

// The groups an identity provider has pushed, and what each one grants: the instance's
// for `workspaceId` null, set up by god, or a workspace's, set up by its owner. The group
// and its members belong to the provider and are read-only here; the mappings are what
// turns group membership into project access. The instance's groups grant any project
// outside a workspace with SCIM of its own, a workspace's the projects of that workspace.
export interface ProvisionedGroupMapping {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface ProvisionedGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  memberCount: number;
  mappings: ProvisionedGroupMapping[];
}

export async function listProvisionedGroups(
  workspaceId: number | null,
): Promise<ProvisionedGroup[]> {
  const own = ofProvider(scimGroup.workspaceId, workspaceId);
  const [groups, counts, mappings] = await Promise.all([
    db.select().from(scimGroup).where(own).orderBy(scimGroup.displayName),
    db
      .select({ groupId: scimGroupMember.groupId, count: sql<number>`count(*)::int` })
      .from(scimGroupMember)
      .innerJoin(scimGroup, eq(scimGroup.id, scimGroupMember.groupId))
      .where(own)
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
      .innerJoin(scimGroup, eq(scimGroup.id, scimGroupMapping.groupId))
      .innerJoin(project, eq(project.id, scimGroupMapping.projectId))
      .where(own)
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
export async function setGroupMappings(
  workspaceId: number | null,
  groupId: string,
  mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
): Promise<ProvisionedGroup> {
  const found = await db
    .select({ id: scimGroup.id })
    .from(scimGroup)
    .where(and(eq(scimGroup.id, groupId), ofProvider(scimGroup.workspaceId, workspaceId)));
  if (!found[0]) throw new HttpError(404, 'Group not found');

  const projectIds = mappings.map((m) => m.projectId);
  if (new Set(projectIds).size !== projectIds.length) {
    throw new HttpError(400, 'A group can be mapped to a project only once');
  }
  const before = await mappedProjectIds(groupId);
  if (projectIds.length > 0) {
    // A mapping the group already has is kept even where it may no longer grant: the
    // reconciliation passes over it there, and it grants again once that changes.
    const where = await grantable(workspaceId);
    const known = await db
      .select({ id: project.id, teamId: project.teamId })
      .from(project)
      .innerJoin(team, eq(team.id, project.teamId))
      .where(and(inArray(project.id, projectIds), where && or(where, inArray(project.id, before))));
    if (known.length !== projectIds.length) throw new HttpError(400, 'Unknown project');
    // A custom role belongs to one team, so a mapping that names another team's role
    // would silently grant the wrong permissions. A system role fits every team.
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
        if (!role || (role.teamId !== null && role.teamId !== teamId)) {
          throw new HttpError(400, 'The role does not belong to that project');
        }
      }
    }
  }

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

  const groups = await listProvisionedGroups(workspaceId);
  return groups.find((g) => g.id === groupId)!;
}

// Every project a group may grant, with the system roles and the roles of the team that
// owns it. What the group mapping form fills its project and role selects from.
export async function listMappableProjects(workspaceId: number | null) {
  const where = await grantable(workspaceId);
  const [projects, roles, system] = await Promise.all([
    db
      .select({ id: project.id, key: project.key, name: project.name, teamId: project.teamId })
      .from(project)
      .innerJoin(team, eq(team.id, project.teamId))
      .where(where)
      .orderBy(asc(project.key)),
    db
      .select({ id: teamRole.id, name: teamRole.name, teamId: teamRole.teamId })
      .from(teamRole)
      .innerJoin(team, eq(team.id, teamRole.teamId))
      .where(where)
      .orderBy(asc(teamRole.id)),
    db
      .select({ id: teamRole.id, name: teamRole.name })
      .from(teamRole)
      .where(isNull(teamRole.teamId))
      .orderBy(asc(teamRole.id)),
  ]);
  return projects.map(({ teamId, ...entry }) => ({
    ...entry,
    roles: [
      ...system,
      ...roles.filter((role) => role.teamId === teamId).map(({ id, name }) => ({ id, name })),
    ],
  }));
}

// The teams whose projects a provider's groups may grant, as a condition on `team`: a
// workspace's own, or for the instance's provider every team outside a workspace with
// SCIM of its own.
async function grantable(workspaceId: number | null) {
  if (workspaceId !== null) return eq(team.workspaceId, workspaceId);
  const own = await workspacesWithOwnScim();
  return own.length > 0 ? notInArray(team.workspaceId, own) : undefined;
}

// A workspace turning its own SCIM on or off takes the instance's groups out of its
// projects or lets them back in, so every project of it a group grants is reconciled.
export async function reconcileWorkspaceGrants(workspaceId: number): Promise<void> {
  const rows = await db
    .selectDistinct({ projectId: scimGroupMapping.projectId })
    .from(scimGroupMapping)
    .innerJoin(project, eq(project.id, scimGroupMapping.projectId))
    .innerJoin(team, eq(team.id, project.teamId))
    .where(eq(team.workspaceId, workspaceId));
  await reconcileProjects(rows.map((row) => row.projectId));
}
