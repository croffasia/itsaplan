import { db, agentRun, agentSchedule, aiAgent, project, team, issue, revision } from '@repo/db';
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { readableProjectIds } from '#shared/access';
import { iso } from '#shared/lib';
import { executionState, contextTokensOf, runDocumentVisibleTo } from '../core/run-queue';

// An agent with an invocation URL is sent its work and only calls back while it has
// some, so its last contact says nothing about whether the endpoint is up.
const runnerPresence = sql<'push' | 'online' | 'offline' | 'never'>`CASE
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

export async function listRunnerQueue(
  userId: string,
  window: { limit: number; offset: number },
  mcpOnly = false,
  runId?: number,
) {
  const ids = await queueProjectIds(userId, mcpOnly);
  if (!ids.length) return { items: [], total: 0, queued: 0, running: 0 };
  // A run started in a document carries its comment, so it also takes reading documents.
  const documentIds = await readableProjectIds(userId, [['documents', 'read']], {
    mcpOnly,
    includeArchived: true,
  });
  const where = and(
    inArray(agentRun.projectId, ids),
    runId == null ? undefined : eq(agentRun.id, runId),
    eq(aiAgent.kind, 'external'),
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
