import {
  db,
  agentRun,
  aiAgent,
  project,
  projectMember,
  team,
  teamRole,
  issue,
  revision,
} from '@repo/db';
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { workspaceGrants } from '#modules/workspaces/service';
import { toMemberContext, type MemberRole } from '#modules/members/service';
import { projectAccess } from '#shared/workspace-roles';
import { hasPermission } from '#shared/permissions';
import { iso } from '#shared/lib';
import { executionState, contextTokensOf } from '../core/run-queue';

const runnerPresence = sql<'online' | 'offline' | 'never'>`CASE
  WHEN ${aiAgent.lastSeenAt} IS NULL THEN 'never'
  WHEN ${aiAgent.lastSeenAt} > now() - interval '90 seconds' THEN 'online'
  ELSE 'offline' END`;

async function queueProjectIds(userId: string, mcpOnly = false) {
  const grants = await workspaceGrants(userId);
  const grantedTeams = [...grants.keys()];
  const rows = await db
    .select({
      id: project.id,
      teamId: project.teamId,
      role: projectMember.role,
      permissions: teamRole.permissions,
    })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .leftJoin(
      projectMember,
      and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId)),
    )
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .where(
      and(
        mcpOnly ? and(eq(project.mcpEnabled, true), eq(team.mcpEnabled, true)) : undefined,
        or(
          isNotNull(projectMember.userId),
          grantedTeams.length ? inArray(project.teamId, grantedTeams) : undefined,
        ),
      ),
    );
  return rows
    .filter((row) => {
      const member = row.role ? toMemberContext(row.role as MemberRole, row.permissions) : null;
      const access = projectAccess(member, grants.get(row.teamId) ?? null);
      return (
        access &&
        hasPermission(access.permissions, 'work_items', 'read') &&
        hasPermission(access.permissions, 'ai_agents', 'read')
      );
    })
    .map((row) => row.id)
    .sort((a, b) => a - b);
}

export async function listRunnerQueue(
  userId: string,
  window: { limit: number; offset: number },
  mcpOnly = false,
  runId?: number,
) {
  const ids = await queueProjectIds(userId, mcpOnly);
  if (!ids.length) return { items: [], total: 0, queued: 0, running: 0 };
  const where = and(
    inArray(agentRun.projectId, ids),
    runId == null ? undefined : eq(agentRun.id, runId),
    eq(aiAgent.kind, 'external'),
    or(isNull(agentRun.issueId), eq(issue.projectId, agentRun.projectId)),
  );
  const [rows, counted] = await Promise.all([
    db
      .select({
        id: agentRun.id,
        agentId: agentRun.agentId,
        username: aiAgent.username,
        kind: aiAgent.kind,
        status: agentRun.status,
        executionState,
        trigger: agentRun.trigger,
        prompt: agentRun.prompt,
        output: agentRun.output,
        attempts: agentRun.attempts,
        lastError: agentRun.lastError,
        inputTokens: agentRun.inputTokens,
        outputTokens: agentRun.outputTokens,
        createdAt: agentRun.createdAt,
        startedAt: agentRun.startedAt,
        finishedAt: agentRun.finishedAt,
        nextAttemptAt: agentRun.nextAttemptAt,
        runnerState: runnerPresence,
        issueId: agentRun.issueId,
        sequenceNumber: issue.sequenceNumber,
        issueTitle: issue.title,
        projectKey: project.key,
        teamRef: sql<string>`coalesce(${team.slug}, ${team.id}::text)`,
      })
      .from(agentRun)
      .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
      .innerJoin(project, eq(project.id, agentRun.projectId))
      .innerJoin(team, eq(team.id, project.teamId))
      .leftJoin(issue, eq(issue.id, agentRun.issueId))
      .where(where)
      .orderBy(
        sql`CASE WHEN ${executionState} = 'running' THEN 0 WHEN ${agentRun.status} = 'pending' THEN 1 ELSE 2 END`,
        sql`CASE WHEN ${agentRun.status} = 'pending' THEN ${agentRun.nextAttemptAt} END ASC`,
        desc(agentRun.createdAt),
        desc(agentRun.id),
      )
      .limit(window.limit)
      .offset(window.offset),
    db
      .select({
        total: sql<number>`count(*)::int`,
        queued: sql<number>`count(*) FILTER (WHERE ${executionState} = 'queued')::int`,
        running: sql<number>`count(*) FILTER (WHERE ${executionState} = 'running')::int`,
      })
      .from(agentRun)
      .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
      .leftJoin(issue, eq(issue.id, agentRun.issueId))
      .where(where),
  ]);
  const total = counted[0]?.total ?? 0;
  const running = counted[0]?.running ?? 0;
  return {
    items: rows.map(({ inputTokens, outputTokens, teamRef, projectKey, ...row }) => ({
      ...row,
      projectRef: `${teamRef}.${projectKey}`,
      ...contextTokensOf({ inputTokens, outputTokens }),
      createdAt: iso(row.createdAt),
      nextAttemptAt: iso(row.nextAttemptAt),
      startedAt: row.startedAt ? iso(row.startedAt) : null,
      finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
    })),
    total,
    queued: counted[0]?.queued ?? 0,
    running,
  };
}

export async function runnerQueueRevision(userId: string, mcpOnly = false) {
  const ids = await queueProjectIds(userId, mcpOnly);
  if (!ids.length) return '0';
  const [rows, expiredRows, presence] = await Promise.all([
    db
      .select({ scope: revision.scope, rev: revision.rev })
      .from(revision)
      .where(
        inArray(
          revision.scope,
          ids.map((id) => `runner-queue:${id}`),
        ),
      )
      .orderBy(revision.scope),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(agentRun)
      .where(
        and(
          inArray(agentRun.projectId, ids),
          eq(agentRun.status, 'pending'),
          isNotNull(agentRun.executionStartedAt),
          sql`${agentRun.nextAttemptAt} <= now()`,
        ),
      ),
    db
      .selectDistinct({ id: aiAgent.id, state: runnerPresence })
      .from(aiAgent)
      .innerJoin(agentRun, eq(agentRun.agentId, aiAgent.id))
      .where(
        and(
          inArray(agentRun.projectId, ids),
          eq(agentRun.status, 'pending'),
          eq(aiAgent.kind, 'external'),
        ),
      )
      .orderBy(aiAgent.id),
  ]);
  return [
    ids.join(','),
    rows.map((row) => `${row.scope}=${row.rev}`).join(','),
    expiredRows[0]?.total ?? 0,
    presence.map((row) => `${row.id}=${row.state}`).join(','),
  ].join(':');
}
