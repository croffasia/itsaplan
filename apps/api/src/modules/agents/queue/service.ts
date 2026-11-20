import {
  db,
  agentRun,
  agentSchedule,
  aiAgent,
  hasPermission,
  project,
  projectMember,
  team,
  issue,
  revision,
  teamMember,
  teamWorkspaceId,
  user,
} from '@repo/db';
import { and, desc, eq, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from 'drizzle-orm';
import {
  assertPermission,
  getProjectAccess,
  getTeamAccess,
  readableProjectIds,
  type AuthUser,
} from '#shared/access';
import { getProjectTeamId } from '#modules/projects/service';
import type { WorkspaceGrant } from '#shared/workspace-roles';
import { runsTeam } from '#modules/teams/service';
import { projectRefSql } from '#modules/teams/ref';
import { HttpError, iso, likePattern } from '#shared/lib';
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

function queueProjectIds(userId: string, mcpOnly = false, grants?: Map<number, WorkspaceGrant>) {
  return readableProjectIds(userId, [['ai_agents', 'read']], {
    mcpOnly,
    includeArchived: true,
    grants,
  });
}

// Where the run comes from (see ../core/run-initiator.ts): its initiator, who queued it,
// and the run an agent queued it in with the first run of that chain. A run the reader
// may not open is still named, so the chain stays readable; opening it asks again.
const runOriginColumns = {
  initiator: sql<{ id: string; name: string; image: string | null } | null>`(
    SELECT json_build_object('id', u.id, 'name', u.name, 'image', u.image) FROM "user" u
    WHERE u.id = ${agentRun.requestedByUserId})`,
  startedBy: sql<{ name: string; image: string | null; agentUsername: string | null } | null>`(
    SELECT json_build_object('name', u.name, 'image', u.image, 'agentUsername', g.username)
    FROM "user" u LEFT JOIN ai_agent g ON g.user_id = u.id
    WHERE u.id = ${agentRun.startedByUserId})`,
  parentRun: sql<{ id: number; projectRef: string } | null>`(
    SELECT json_build_object('id', r.id, 'projectRef', coalesce(t.slug, t.id::text) || '.' || p.key)
    FROM agent_run r JOIN project p ON p.id = r.project_id JOIN team t ON t.id = p.team_id
    WHERE r.id = ${agentRun.parentRunId})`,
  rootRun: sql<{
    id: number;
    projectRef: string;
    scheduleName: string | null;
    initiator: { name: string; image: string | null } | null;
  } | null>`(
    SELECT json_build_object('id', r.id, 'projectRef', coalesce(t.slug, t.id::text) || '.' || p.key,
      'scheduleName', s.name,
      'initiator', (SELECT json_build_object('name', u.name, 'image', u.image) FROM "user" u
        WHERE u.id = r.requested_by_user_id))
    FROM agent_run r JOIN project p ON p.id = r.project_id JOIN team t ON t.id = p.team_id
      LEFT JOIN agent_schedule s ON s.id = r.schedule_id
    WHERE r.id = ${agentRun.rootRunId})`,
};

function runMatches(term: string) {
  const pattern = likePattern(term);
  return or(
    ilike(issue.title, pattern),
    ilike(sql`${project.key} || '-' || ${issue.sequenceNumber}`, pattern),
    ilike(agentSchedule.name, pattern),
    ilike(aiAgent.username, likePattern(term.replace(/^@/, ''))),
  );
}

const runStates = {
  failed: sql`${executionState} = 'failed'`,
  active: sql`${executionState} IN ('queued', 'running')`,
};

// A run's answer is for whoever runs the project's team or reads its agents.
export async function assertReadsRuns(projectId: number, user: AuthUser): Promise<void> {
  if (await runsProjectTeam(await getProjectTeamId(projectId), user.id)) return;
  await assertPermission(projectId, user, 'ai_agents', 'read');
}

// Whether the user reads the steps of every run in the project, what each agent did:
// whoever runs its team, an owner of it, and whoever may create or change its agents.
export async function readsAllRunSteps(projectId: number, userId: string): Promise<boolean> {
  if (await runsProjectTeam(await getProjectTeamId(projectId), userId)) return true;
  const access = await getProjectAccess(projectId, userId);
  if (!access) return false;
  return (
    access.role === 'owner' ||
    hasPermission(access.permissions, 'ai_agents', 'edit') ||
    hasPermission(access.permissions, 'ai_agents', 'create')
  );
}

// A run's steps are also for its initiator.
export async function assertReadsRunSteps(
  run: { projectId: number; initiatorUserId: string | null },
  userId: string,
): Promise<void> {
  if (run.initiatorUserId === userId || (await readsAllRunSteps(run.projectId, userId))) return;
  throw new HttpError(
    403,
    "Only whoever may create or change the project's agents, or the run's initiator, reads its steps",
  );
}

// The projects of a run list. `projectIds` narrows it to those, of the ones the caller may
// read. With `granted` the caller reads every one of them, as whoever runs their team or
// workspace does, so their permissions in each are not asked; an MCP client keeps to its
// own still.
interface RunListScope {
  mcpOnly?: boolean;
  projectIds?: number[];
  granted?: boolean;
}

// The projects of the list and the runs of them it shows: not a run of an issue that moved
// to another project, nor one from a document private from the caller.
async function runListScope(
  userId: string,
  { mcpOnly = false, projectIds, granted = false }: RunListScope,
) {
  const trusted = granted && !mcpOnly ? projectIds : undefined;
  const readable = trusted ?? (await queueProjectIds(userId, mcpOnly));
  const ids = projectIds ? readable.filter((id) => projectIds.includes(id)) : readable;
  const visible = and(
    inArray(agentRun.projectId, ids),
    or(isNull(agentRun.issueId), eq(issue.projectId, agentRun.projectId)),
    runDocumentVisibleTo(userId),
  );
  return { ids, visible };
}

// Who a list can be filtered by: the people of its projects, and whoever started one of
// its runs and has left since. Agents are left out, because a run is never started by one.
export async function listRunInitiators(userId: string, scope: RunListScope) {
  const { ids, visible } = await runListScope(userId, scope);
  if (!ids.length) return [];
  const members = db
    .select({ id: projectMember.userId })
    .from(projectMember)
    .where(inArray(projectMember.projectId, ids));
  const initiators = db
    .select({ id: sql<string>`${agentRun.requestedByUserId}` })
    .from(agentRun)
    .leftJoin(issue, eq(issue.id, agentRun.issueId))
    .where(and(visible, isNotNull(agentRun.requestedByUserId)));
  const agents = db.select({ id: aiAgent.userId }).from(aiAgent);
  return db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(
      and(or(inArray(user.id, members), inArray(user.id, initiators)), notInArray(user.id, agents)),
    )
    .orderBy(user.name, user.id);
}

// The projects of a list, for its filter.
export async function listRunProjects(userId: string, scope: RunListScope) {
  const { ids } = await runListScope(userId, scope);
  if (!ids.length) return [];
  return db
    .select({ id: project.id, name: project.name, ref: projectRefSql })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(inArray(project.id, ids))
    .orderBy(project.name, project.id);
}

// `state`, `q`, `initiatorIds` and `onlyProjectIds` narrow the list; the counts of waiting,
// running and failed runs follow all but `state`, so each state can show how many runs it
// holds.
export async function listRunnerQueue(
  userId: string,
  window: { limit: number; offset: number },
  {
    runId,
    state,
    q,
    initiatorIds,
    onlyProjectIds,
    ...scope
  }: RunListScope & {
    runId?: number;
    state?: keyof typeof runStates;
    q?: string;
    initiatorIds?: string[];
    onlyProjectIds?: number[];
  } = {},
) {
  const { ids, visible } = await runListScope(userId, scope);
  if (!ids.length) return { items: [], total: 0, queued: 0, running: 0, failed: 0 };
  const term = q?.trim();
  const scoped = and(
    visible,
    runId == null ? undefined : eq(agentRun.id, runId),
    term ? runMatches(term) : undefined,
    initiatorIds?.length ? inArray(agentRun.requestedByUserId, initiatorIds) : undefined,
    onlyProjectIds?.length ? inArray(agentRun.projectId, onlyProjectIds) : undefined,
  );
  const stateFilter = state ? runStates[state] : undefined;
  const where = and(scoped, stateFilter);
  const [rows, counted] = await Promise.all([
    db
      .select({
        id: agentRun.id,
        projectId: agentRun.projectId,
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
        scheduleId: agentRun.scheduleId,
        scheduleName: agentSchedule.name,
        document: sql<{ id: number; title: string } | null>`(
          SELECT json_build_object('id', d.id, 'title', d.title) FROM project_document d
          WHERE d.id = ${agentRun.documentId})`,
        ...runOriginColumns,
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
        total: stateFilter
          ? sql<number>`count(*) FILTER (WHERE ${stateFilter})::int`
          : sql<number>`count(*)::int`,
        queued: sql<number>`count(*) FILTER (WHERE ${executionState} = 'queued')::int`,
        running: sql<number>`count(*) FILTER (WHERE ${executionState} = 'running')::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${runStates.failed})::int`,
      })
      .from(agentRun)
      .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
      .innerJoin(project, eq(project.id, agentRun.projectId))
      .leftJoin(issue, eq(issue.id, agentRun.issueId))
      .leftJoin(agentSchedule, eq(agentSchedule.id, agentRun.scheduleId))
      .where(scoped),
  ]);
  const total = counted[0]?.total ?? 0;
  const running = counted[0]?.running ?? 0;
  const allSteps = new Map(
    await Promise.all(
      [...new Set(rows.map((row) => row.projectId))].map(
        async (id) => [id, await readsAllRunSteps(id, userId)] as const,
      ),
    ),
  );
  return {
    items: rows.map(({ teamRef, projectKey, projectId, ...row }) => ({
      ...row,
      canReadSteps: allSteps.get(projectId) === true || row.initiator?.id === userId,
      projectRef: `${teamRef}.${projectKey}`,
      ...contextTokensOf(row),
      createdAt: iso(row.createdAt),
      nextAttemptAt: iso(row.nextAttemptAt),
      startedAt: row.startedAt ? iso(row.startedAt) : null,
      finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
    })),
    total,
    queued: counted[0]?.queued ?? 0,
    running,
    failed: counted[0]?.failed ?? 0,
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
export async function runnerQueueRevision(
  userId: string,
  grants: Map<number, WorkspaceGrant>,
  mcpOnly = false,
) {
  const [readable, runTeam] = await Promise.all([
    queueProjectIds(userId, mcpOnly, grants),
    mcpOnly ? [] : runTeamProjectIds(userId),
  ]);
  const ids = mcpOnly ? readable : [...new Set([...readable, ...runTeam])].sort((a, b) => a - b);
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
