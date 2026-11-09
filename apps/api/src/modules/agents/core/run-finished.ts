import { agentRun, aiAgent, db, issue, project, user } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ActivityActor } from '#modules/issues/activity';
import { emitWebhookEvents } from '#modules/webhooks/emit';

// 'agent_run.finished', for the webhooks and the api's extensions: one event per project
// and actor with a payload per run, once the run is success, failed or canceled. A run deleted
// with its agent, issue or project sends none. The payload leaves out what the agent
// returned: whoever sets up a webhook may not read the agents, and the run's trace is
// served to those who do.

// Runs their agent ended, which is also the event's actor.
export function emitRunsFinished(runIds: number[]): Promise<void> {
  return emitEnded(runIds, (agentUserId) => agentUserId);
}

// Runs someone ended before their agent did.
export function emitRunsCanceled(runIds: number[], actor: ActivityActor): Promise<void> {
  return emitEnded(runIds, () => actor);
}

async function emitEnded(
  runIds: number[],
  actorOf: (agentUserId: string) => ActivityActor,
): Promise<void> {
  if (runIds.length === 0) return;
  const groups = new Map<string, { projectId: number; actor: ActivityActor; runs: EndedRun[] }>();
  for (const row of await selectRuns(runIds)) {
    const actor = actorOf(row.agentUserId);
    const key = `${row.projectId}:${JSON.stringify(actor ?? null)}`;
    const group = groups.get(key) ?? { projectId: row.projectId, actor, runs: [] };
    group.runs.push(row);
    groups.set(key, group);
  }
  for (const { projectId, actor, runs } of groups.values()) {
    await emitWebhookEvents(
      projectId,
      'agent_run.finished',
      async () => runs.map(runPayload),
      actor,
    );
  }
}

// An issue moved to another project keeps its runs in the project they worked in.
const issueProject = alias(project, 'issue_project');

function selectRuns(runIds: number[]) {
  return db
    .select({
      id: agentRun.id,
      status: agentRun.status,
      trigger: agentRun.trigger,
      agentId: agentRun.agentId,
      agentUserId: aiAgent.userId,
      agentUsername: aiAgent.username,
      agentName: user.name,
      projectId: agentRun.projectId,
      issueProjectKey: issueProject.key,
      issueId: agentRun.issueId,
      issueNumber: issue.sequenceNumber,
      documentId: agentRun.documentId,
      scheduleId: agentRun.scheduleId,
      error: agentRun.lastError,
      attempts: agentRun.attempts,
      inputTokens: agentRun.inputTokens,
      outputTokens: agentRun.outputTokens,
      createdAt: agentRun.createdAt,
      startedAt: agentRun.startedAt,
      finishedAt: agentRun.finishedAt,
    })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .leftJoin(issue, eq(issue.id, agentRun.issueId))
    .leftJoin(issueProject, eq(issueProject.id, issue.projectId))
    .where(inArray(agentRun.id, runIds));
}

type EndedRun = Awaited<ReturnType<typeof selectRuns>>[number];

function runPayload(row: EndedRun) {
  return {
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    agent: {
      id: row.agentId,
      userId: row.agentUserId,
      username: row.agentUsername,
      name: row.agentName,
    },
    projectId: row.projectId,
    issueId: row.issueId,
    issueIdentifier: row.issueNumber == null ? null : `${row.issueProjectKey}-${row.issueNumber}`,
    documentId: row.documentId,
    scheduleId: row.scheduleId,
    error: row.error,
    attempts: row.attempts,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
