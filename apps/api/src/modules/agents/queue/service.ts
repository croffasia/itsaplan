import {
  db,
  agentRun,
  agentSchedule,
  aiAgent,
  project,
  team,
  issue,
  revision,
  teamMember,
  teamWorkspaceId,
} from '@repo/db';
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getTeamAccess, readableProjectIds } from '#shared/access';
import { runsTeam } from '#modules/teams/service';
import { iso } from '#shared/lib';
import { getLimits, getRunLimit } from '#shared/limits';
import {
  executionState,
  contextTokensOf,
  countRunsInFlight,
  holdsSlot,
  runDocumentVisibleTo,
} from '../core/run-queue';

// An agent with an invocation URL is sent its work and only calls back while it has
// some, so its last contact says nothing about whether the endpoint is up. An internal
// agent runs in the api and has no runner.
const runnerPresence = sql<'push' | 'online' | 'offline' | 'never' | null>`CASE
  WHEN ${aiAgent.kind} = 'internal' THEN NULL
  WHEN ${aiAgent.invocationUrl} IS NOT NULL THEN 'push'
  WHEN ${aiAgent.lastSeenAt} IS NULL THEN 'never'
  WHEN ${aiAgent.lastSeenAt} > now() - interval '90 seconds' THEN 'online'
  ELSE 'offline' END`;

function queueProjectIds(userId: string, mcpOnly = false) {
  return readableProjectIds(
    userId,
    [
      ['work_items', 'read'],
      ['ai_agents', 'read'],
    ],
    { mcpOnly, includeArchived: true },
  );
}

// `projectIds` narrows the queue to those projects, of the ones the caller may read. With
// `granted` the caller reads every one of them, as whoever runs their team or workspace
// does, so their permissions in each are not asked; an MCP client keeps to its own still.
export async function listRunnerQueue(
  userId: string,
  window: { limit: number; offset: number },
  {
    mcpOnly = false,
    runId,
    projectIds,
    granted = false,
  }: { mcpOnly?: boolean; runId?: number; projectIds?: number[]; granted?: boolean } = {},
) {
  const trusted = granted && !mcpOnly ? projectIds : undefined;
  const readable = trusted ?? (await queueProjectIds(userId, mcpOnly));
  const ids = projectIds ? readable.filter((id) => projectIds.includes(id)) : readable;
  if (!ids.length) return { items: [], total: 0, queued: 0, running: 0 };
  // A run started in a document carries its comment, so it also takes reading documents.
  const documentIds =
    trusted ??
    (await readableProjectIds(userId, [['documents', 'read']], {
      mcpOnly,
      includeArchived: true,
    }));
  const where = and(
    inArray(agentRun.projectId, ids),
    runId == null ? undefined : eq(agentRun.id, runId),
    or(isNull(agentRun.issueId), eq(issue.projectId, agentRun.projectId)),
    or(isNull(agentRun.documentId), inArray(agentRun.projectId, documentIds)),
    runDocumentVisibleTo(userId),
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
        scheduleName: agentSchedule.name,
        projectKey: project.key,
        teamRef: sql<string>`coalesce(${team.slug}, ${team.id}::text)`,
      })
      .from(agentRun)
      .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
      .innerJoin(project, eq(project.id, agentRun.projectId))
      .innerJoin(team, eq(team.id, project.teamId))
      .leftJoin(issue, eq(issue.id, agentRun.issueId))
      .leftJoin(agentSchedule, eq(agentSchedule.id, agentRun.scheduleId))
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

// Whether the user runs the team: its owner or a manager, or the workspace's owner. They
// read every project of the team without a role in it.
export async function runsProjectTeam(teamId: number, userId: string): Promise<boolean> {
  return runsTeam((await getTeamAccess(teamId, userId))?.role ?? null);
}

// The projects of a team, or of every team of a workspace, archived ones included.
export async function scopeProjectIds(
  scope: { teamId: number } | { workspaceId: number },
): Promise<number[]> {
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where('teamId' in scope ? eq(team.id, scope.teamId) : eq(team.workspaceId, scope.workspaceId));
  return rows.map((row) => row.id);
}

export async function teamRunsInFlight(teamId: number) {
  return workspaceRunsInFlight(await teamWorkspaceId(teamId, db));
}

// The instance's limit is left out: it counts the runs of every workspace, not this one's.
export async function workspaceRunsInFlight(workspaceId: number) {
  const [running, limits] = await Promise.all([
    countRunsInFlight(workspaceId),
    getLimits(workspaceId),
  ]);
  return { running, limit: await getRunLimit(workspaceId, limits) };
}

// The projects of the teams the user owns or manages, whose runs the team's and the
// project's queues list without a role in the project.
async function runTeamProjectIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .innerJoin(teamMember, eq(teamMember.teamId, project.teamId))
    .where(and(eq(teamMember.userId, userId), inArray(teamMember.role, ['owner', 'manager'])));
  return rows.map((row) => row.id);
}

// Covers every project a queue may list to the user, so a run in a project they read only
// as whoever runs its team also moves the marker. The runs in flight in those projects'
// workspaces are counted too: the queue's header shows them, projects the user does not
// read included.
export async function runnerQueueRevision(userId: string, mcpOnly = false) {
  const readable = await queueProjectIds(userId, mcpOnly);
  const ids = mcpOnly
    ? readable
    : [...new Set([...readable, ...(await runTeamProjectIds(userId))])].sort((a, b) => a - b);
  if (!ids.length) return '0';
  const workspaceIds = db
    .selectDistinct({ id: team.workspaceId })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(inArray(project.id, ids));
  const [rows, expiredRows, presence, inFlight] = await Promise.all([
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
    db
      .select({ id: team.workspaceId, running: sql<number>`count(*)::int` })
      .from(agentRun)
      .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
      .innerJoin(project, eq(project.id, agentRun.projectId))
      .innerJoin(team, eq(team.id, project.teamId))
      .where(and(holdsSlot, inArray(team.workspaceId, workspaceIds)))
      .groupBy(team.workspaceId)
      .orderBy(team.workspaceId),
  ]);
  return [
    ids.join(','),
    rows.map((row) => `${row.scope}=${row.rev}`).join(','),
    expiredRows[0]?.total ?? 0,
    presence.map((row) => `${row.id}=${row.state}`).join(','),
    inFlight.map((row) => `${row.id}=${row.running}`).join(','),
  ].join(':');
}
