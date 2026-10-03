import {
  db,
  project,
  scimGroup,
  scimGroupMapping,
  scimGroupMember,
  team,
  teamRole,
} from '@repo/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { mappedProjectIds, reconcileProjects } from '#modules/scim/reconcile';

// The groups a workspace's identity provider has pushed, and what each one grants.
// The group and its members belong to the provider and are read-only here; the
// mappings are the workspace owner's, and are what turns group membership into
// project access.
export interface WorkspaceScimGroupMapping {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface WorkspaceScimGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  memberCount: number;
  mappings: WorkspaceScimGroupMapping[];
}

export async function listWorkspaceScimGroups(workspaceId: number): Promise<WorkspaceScimGroup[]> {
  const [groups, counts, mappings] = await Promise.all([
    db
      .select()
      .from(scimGroup)
      .where(eq(scimGroup.workspaceId, workspaceId))
      .orderBy(scimGroup.displayName),
    db
      .select({ groupId: scimGroupMember.groupId, count: sql<number>`count(*)::int` })
      .from(scimGroupMember)
      .innerJoin(scimGroup, eq(scimGroup.id, scimGroupMember.groupId))
      .where(eq(scimGroup.workspaceId, workspaceId))
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
      .where(eq(scimGroup.workspaceId, workspaceId))
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
// unmapped from loses the memberships that came from it. A group grants access only
// to projects of its own workspace.
export async function setWorkspaceScimGroupMappings(
  workspaceId: number,
  groupId: string,
  mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
): Promise<WorkspaceScimGroup> {
  const found = await db
    .select({ id: scimGroup.id })
    .from(scimGroup)
    .where(and(eq(scimGroup.id, groupId), eq(scimGroup.workspaceId, workspaceId)));
  if (!found[0]) throw new HttpError(404, 'Group not found');

  const projectIds = mappings.map((m) => m.projectId);
  if (new Set(projectIds).size !== projectIds.length) {
    throw new HttpError(400, 'A group can be mapped to a project only once');
  }
  if (projectIds.length > 0) {
    const known = await db
      .select({ id: project.id, teamId: project.teamId })
      .from(project)
      .innerJoin(team, eq(team.id, project.teamId))
      .where(and(inArray(project.id, projectIds), eq(team.workspaceId, workspaceId)));
    if (known.length !== projectIds.length) throw new HttpError(400, 'Unknown project');
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

  const groups = await listWorkspaceScimGroups(workspaceId);
  return groups.find((g) => g.id === groupId)!;
}

// Every project of the workspace with the roles of the team that owns it. What the
// group mapping form fills its project and role selects from.
export async function listWorkspaceProjectOptions(workspaceId: number) {
  const [projects, roles] = await Promise.all([
    db
      .select({ id: project.id, key: project.key, name: project.name, teamId: project.teamId })
      .from(project)
      .innerJoin(team, eq(team.id, project.teamId))
      .where(eq(team.workspaceId, workspaceId))
      .orderBy(asc(project.key)),
    db
      .select({ id: teamRole.id, name: teamRole.name, teamId: teamRole.teamId })
      .from(teamRole)
      .innerJoin(team, eq(team.id, teamRole.teamId))
      .where(eq(team.workspaceId, workspaceId))
      .orderBy(asc(teamRole.id)),
  ]);
  return projects.map(({ teamId, ...entry }) => ({
    ...entry,
    roles: roles.filter((role) => role.teamId === teamId).map(({ id, name }) => ({ id, name })),
  }));
}
