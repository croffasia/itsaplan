import {
  db,
  project,
  team,
  teamMember,
  teamRole,
  workspaceManager,
  projectMember,
  aiAgent,
  agentSchedule,
  agentRun,
  teamInvite,
  gitManagedRepository,
  scimGroupMapping,
  projectAction,
  type DbExecutor,
} from '@repo/db';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { HttpError, pgErrorCode } from '#shared/lib';
import { teamAccess, workspaceRoleGrant } from '#shared/workspace-roles';
import { getTeamLimits } from '#shared/limits';
import { PROJECT_FEATURES } from '#shared/features';
import { runsTeam, type TeamStanding } from '#modules/teams/service';
import { projectRef } from '#modules/teams/ref';
import { mapProject, type ProjectRow } from './service';
import type { ProjectTransferPreview, TransferProjectInput } from './transfer-model';

async function requireTransferTeam(executor: DbExecutor, teamId: number, userId: string) {
  const [row] = await executor.select().from(team).where(eq(team.id, teamId));
  const [member] = await executor
    .select()
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  const [manager] = row
    ? await executor
        .select()
        .from(workspaceManager)
        .where(
          and(
            eq(workspaceManager.workspaceId, row.workspaceId),
            eq(workspaceManager.userId, userId),
          ),
        )
    : [];
  const access = teamAccess(
    (member?.role as TeamStanding | undefined) ?? null,
    manager ? workspaceRoleGrant(manager.role) : null,
  );
  if (!row || !access) throw new HttpError(404, 'Team not found');
  if (!runsTeam(access.role))
    throw new HttpError(403, 'Only an owner or manager of both teams may transfer a project');
  return row;
}

async function checkTransfer(
  executor: DbExecutor,
  projectId: number,
  targetTeamId: number,
  userId: string,
  mcpOnly: boolean,
) {
  const [agent] = await executor
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(eq(aiAgent.userId, userId));
  if (agent) throw new HttpError(403, 'Agents cannot transfer projects');
  const [current] = await executor.select().from(project).where(eq(project.id, projectId));
  if (!current) throw new HttpError(404, 'Project not found');
  const source = await requireTransferTeam(executor, current.teamId, userId);
  const target = await requireTransferTeam(executor, targetTeamId, userId);
  if (mcpOnly && (!current.mcpEnabled || !source.mcpEnabled || !target.mcpEnabled))
    throw new HttpError(403, 'MCP must be enabled on the project and both teams');
  if (source.workspaceId !== target.workspaceId)
    throw new HttpError(409, 'Projects can only move between teams in the same workspace');
  const blockers: ProjectTransferPreview['blockers'] = [];
  const block = (code: string, message: string) => blockers.push({ code, message });
  if (current.archivedAt) block('archived_project', 'Restore the project before transferring it');
  const conflicts = await executor
    .select({ id: project.id })
    .from(project)
    .where(
      and(eq(project.teamId, target.id), eq(project.key, current.key), ne(project.id, projectId)),
    );
  if (conflicts.length) block('key_conflict', 'The destination already has this project key');
  const members = await executor
    .select({
      userId: projectMember.userId,
      role: projectMember.role,
      roleId: projectMember.roleId,
      source: projectMember.source,
      agentId: aiAgent.id,
    })
    .from(projectMember)
    .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
    .where(eq(projectMember.projectId, projectId));
  const targetMembers = await executor
    .select({ userId: teamMember.userId })
    .from(teamMember)
    .where(eq(teamMember.teamId, target.id));
  const memberIds = new Set(targetMembers.map((m) => m.userId));
  const humans = members.filter((m) => m.agentId === null);
  if (humans.some((m) => !memberIds.has(m.userId)))
    block('missing_membership', 'Add every human project member to the destination team first');
  if (members.some((m) => m.agentId !== null))
    block(
      'agent_members',
      'Detach project agents before transferring; agents remain on their team',
    );
  const scim = await executor
    .select({ id: scimGroupMapping.id })
    .from(scimGroupMapping)
    .where(eq(scimGroupMapping.projectId, projectId));
  if (scim.length || members.some((m) => m.source === 'scim'))
    block('scim_memberships', 'Remove identity-provider project mappings before transferring');
  const invites = await executor
    .select({ id: teamInvite.id })
    .from(teamInvite)
    .where(and(eq(teamInvite.projectId, projectId), eq(teamInvite.status, 'pending')));
  if (invites.length) block('pending_invites', 'Resolve pending project invitations first');
  const schedules = await executor
    .select({ id: agentSchedule.id })
    .from(agentSchedule)
    .where(eq(agentSchedule.projectId, projectId));
  if (schedules.length)
    block('agent_schedules', 'Remove project agent schedules, including paused schedules, first');
  const runs = await executor
    .select({ id: agentRun.id })
    .from(agentRun)
    .where(and(eq(agentRun.projectId, projectId), eq(agentRun.status, 'pending')));
  if (runs.length) block('pending_runs', 'Finish or cancel pending project agent runs first');
  const repositories = await executor
    .select({ id: gitManagedRepository.id })
    .from(gitManagedRepository)
    .where(eq(gitManagedRepository.projectId, projectId));
  if (repositories.length)
    block(
      'managed_repositories',
      'Disconnect managed repositories from their team connections first',
    );
  const actions = await executor
    .select({ id: projectAction.id })
    .from(projectAction)
    .where(eq(projectAction.projectId, projectId));
  if (actions.length)
    block(
      'project_actions',
      'Remove saved actions before transferring; their arbitrary JSON may reference team resources',
    );
  const roles = await executor.select().from(teamRole).where(eq(teamRole.teamId, source.id));
  if (members.some((m) => m.roleId !== null && !roles.some((r) => r.id === m.roleId)))
    block('foreign_roles', 'Resolve member roles that do not belong to the source team first');
  const requiredRoles = roles.flatMap((role) => {
    const count = members.filter((m) => m.role === 'member' && m.roleId === role.id).length;
    return count ? [{ sourceRoleId: role.id, name: role.name, memberCount: count }] : [];
  });
  const targetRoles = await executor.select().from(teamRole).where(eq(teamRole.teamId, target.id));
  const { blockedFeatures } = await getTeamLimits(target.id, executor);
  const preview: ProjectTransferPreview = {
    projectId,
    sourceTeamId: source.id,
    targetTeamId: target.id,
    targetRef: projectRef(target, current.key),
    memberCount: humans.length,
    canTransfer: blockers.length === 0,
    blockers,
    requiredRoles,
    targetDefaultRoleId: targetRoles.find((r) => r.isDefault)?.id ?? null,
    targetAvailableFeatures: PROJECT_FEATURES.filter((f) => !blockedFeatures.includes(f)),
    notificationProvidersChange: source.id !== target.id,
  };
  return { target, targetRoles, preview };
}

export async function previewProjectTransfer(
  projectId: number,
  targetTeamId: number,
  userId: string,
  mcpOnly: boolean,
): Promise<ProjectTransferPreview> {
  return (await checkTransfer(db, projectId, targetTeamId, userId, mcpOnly)).preview;
}

export async function transferProject(
  ref: string,
  input: TransferProjectInput,
  userId: string,
  mcpOnly: boolean,
): Promise<ProjectRow> {
  try {
    const moved = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      // Team writers lock the team first. Keep that order, and serialize dependency
      // commits on the project row through check_project_team_reference.
      await tx
        .select({ id: team.id })
        .from(team)
        .where(inArray(team.id, [input.sourceTeamId, input.targetTeamId]))
        .orderBy(team.id)
        .for('update');
      await tx
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, input.projectId))
        .for('update');
      const [current] = await tx.select().from(project).where(eq(project.id, input.projectId));
      if (!current) throw new HttpError(404, 'Project not found');
      const original = await requireTransferTeam(tx, input.sourceTeamId, userId);
      if (mcpOnly && !original.mcpEnabled)
        throw new HttpError(403, 'MCP must be enabled on both teams');
      if (current.teamId !== input.sourceTeamId && current.teamId !== input.targetTeamId)
        throw new HttpError(409, 'The project has moved to another team');
      const state = await checkTransfer(tx, current.id, input.targetTeamId, userId, mcpOnly);
      if (current.teamId === input.targetTeamId) return { current, target: state.target };
      const qualified = projectRef(original, current.key);
      if (ref !== current.key && ref !== qualified && ref !== `${original.id}.${current.key}`)
        throw new HttpError(409, 'The project reference and project ID do not match');
      if (state.preview.blockers.length)
        throw new HttpError(
          409,
          state.preview.blockers.map((b) => b.message).join('; '),
          'project_transfer_blocked',
        );
      const mappings = new Map<number, number | null>();
      for (const mapping of input.roleMappings ?? []) {
        if (
          mappings.has(mapping.sourceRoleId) ||
          !state.preview.requiredRoles.some((r) => r.sourceRoleId === mapping.sourceRoleId)
        )
          throw new HttpError(400, 'Role mappings must name each used source role at most once');
        if (
          mapping.targetRoleId !== null &&
          !state.targetRoles.some((r) => r.id === mapping.targetRoleId)
        )
          throw new HttpError(400, 'Mapped roles must belong to the destination team');
        mappings.set(
          mapping.sourceRoleId,
          mapping.targetRoleId ?? state.preview.targetDefaultRoleId,
        );
      }
      if (state.preview.requiredRoles.some((r) => !mappings.has(r.sourceRoleId)))
        throw new HttpError(
          409,
          'Explicit mappings are required for project member roles',
          'project_transfer_roles_required',
        );
      // Clear old roles before the ownership change; both updates commit together.
      for (const [sourceRoleId, targetRoleId] of mappings) {
        await tx
          .update(projectMember)
          .set({ roleId: targetRoleId })
          .where(
            and(
              eq(projectMember.projectId, current.id),
              eq(projectMember.roleId, sourceRoleId),
              eq(projectMember.role, 'member'),
            ),
          );
      }
      await tx
        .update(projectMember)
        .set({ roleId: state.preview.targetDefaultRoleId })
        .where(
          and(
            eq(projectMember.projectId, current.id),
            eq(projectMember.role, 'member'),
            isNull(projectMember.roleId),
          ),
        );
      await tx
        .update(projectMember)
        .set({ roleId: null })
        .where(and(eq(projectMember.projectId, current.id), eq(projectMember.role, 'owner')));
      const [updated] = await tx
        .update(project)
        .set({ teamId: state.target.id })
        .where(eq(project.id, current.id))
        .returning();
      return { current: updated, target: state.target };
    });
    return mapProject({
      ...moved.current,
      teamName: moved.target.name,
      teamSlug: moved.target.slug,
      teamMcpEnabled: moved.target.mcpEnabled,
    });
  } catch (error) {
    if (['23505', '23503', '40001', '40P01', '55P03'].includes(pgErrorCode(error) ?? ''))
      throw new HttpError(
        409,
        'The project or destination changed during transfer; preview and try again',
      );
    throw error;
  }
}
