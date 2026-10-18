import { db, agentActionLog, agentPendingAction, aiAgent, issue, project, user } from '@repo/db';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HttpError, iso } from '#shared/lib';
import { routeTools } from '#mcp/generate';
import { dispatchTool } from '#mcp/dispatch';
import { getMcpApp } from '#mcp/app-ref';
import {
  getAgentInProject,
  getInternalAgentApiKey,
  type AiAgentRow,
} from '#modules/agents/core/service';
import { runPendingCustomTool } from '#modules/agents/core/runtime/tools/custom-tools';
import { getProjectByRef } from '#modules/projects/service';
import { getIssueProjectId } from '#modules/issues/service';

type Window = { limit: number; offset: number };

export type PendingActionStatus =
  'pending' | 'applying' | 'approved' | 'rejected' | 'failed' | 'expired';

// Null is every project of the team; an empty list is none.
function inProjects(column: AnyColumn, projectIds: number[] | null): SQL | undefined {
  if (projectIds == null) return undefined;
  return projectIds.length > 0 ? inArray(column, projectIds) : sql`false`;
}

// How long a held call waits for a decision. An older one expires and applies nothing.
export const PENDING_ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function recordAgentAction(input: {
  agentId: number;
  projectId: number;
  issueId: number | null;
  runId: number | null;
  tool: string;
  args: Record<string, unknown>;
  error: string | null;
  approvedByUserId?: string;
}) {
  const { error, issueId, ...rest } = input;
  // A failed call can name an issue that does not exist; the row then has no issue.
  await db.insert(agentActionLog).values({
    ...rest,
    issueId: issueId == null ? null : sql`(select id from issue where id = ${issueId})`,
    status: error == null ? 'success' : 'failed',
    error,
  });
}

// A write an agent made through the MCP endpoint with its own key. The project comes
// from the call's projectKey or issueId; a call that names neither, or a caller that is
// not an agent, is not logged.
export async function recordMcpAgentAction(
  userId: string,
  tool: string,
  args: Record<string, unknown>,
  error: string | null,
) {
  const [agent] = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(eq(aiAgent.userId, userId))
    .limit(1);
  if (!agent) return;
  const issueId = typeof args.issueId === 'number' ? args.issueId : null;
  const projectId =
    typeof args.projectKey === 'string'
      ? ((await getProjectByRef(args.projectKey, userId))?.id ?? null)
      : issueId != null
        ? await getIssueProjectId(issueId)
        : null;
  if (projectId == null) return;
  await recordAgentAction({
    agentId: agent.id,
    projectId,
    issueId,
    runId: null,
    tool,
    args,
    error,
  });
}

const approver = alias(user, 'approver');

export async function listAgentActions(
  agentId: number,
  projectIds: number[] | null,
  range: { from?: Date; to?: Date },
  window: Window,
) {
  const where = and(
    eq(agentActionLog.agentId, agentId),
    inProjects(agentActionLog.projectId, projectIds),
    range.from ? gte(agentActionLog.createdAt, range.from) : undefined,
    range.to ? lt(agentActionLog.createdAt, range.to) : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: agentActionLog.id,
        tool: agentActionLog.tool,
        args: agentActionLog.args,
        status: agentActionLog.status,
        error: agentActionLog.error,
        projectId: agentActionLog.projectId,
        issueId: agentActionLog.issueId,
        projectKey: project.key,
        sequenceNumber: issue.sequenceNumber,
        issueTitle: issue.title,
        runId: agentActionLog.runId,
        approvedByUserId: agentActionLog.approvedByUserId,
        approvedByName: approver.name,
        createdAt: agentActionLog.createdAt,
      })
      .from(agentActionLog)
      .innerJoin(project, eq(project.id, agentActionLog.projectId))
      .leftJoin(issue, eq(issue.id, agentActionLog.issueId))
      .leftJoin(approver, eq(approver.id, agentActionLog.approvedByUserId))
      .where(where)
      .orderBy(desc(agentActionLog.createdAt), desc(agentActionLog.id))
      .limit(window.limit)
      .offset(window.offset),
    db.select({ value: count() }).from(agentActionLog).where(where),
  ]);
  return {
    items: rows.map(({ projectKey, sequenceNumber, ...row }) => ({
      ...row,
      status: row.status as 'success' | 'failed',
      issueKey: sequenceNumber == null ? null : `${projectKey}-${sequenceNumber}`,
      createdAt: iso(row.createdAt),
    })),
    total: total?.value ?? 0,
  };
}

const pendingColumns = {
  id: agentPendingAction.id,
  agentId: agentPendingAction.agentId,
  agentName: user.name,
  projectId: agentPendingAction.projectId,
  issueId: agentPendingAction.issueId,
  runId: agentPendingAction.runId,
  tool: agentPendingAction.tool,
  args: agentPendingAction.args,
  status: agentPendingAction.status,
  reason: agentPendingAction.reason,
  result: agentPendingAction.result,
  decidedByUserId: agentPendingAction.decidedByUserId,
  decidedAt: agentPendingAction.decidedAt,
  createdAt: agentPendingAction.createdAt,
};

function toPendingDto(row: Awaited<ReturnType<typeof pendingQuery>>[number]) {
  return {
    ...row,
    status: row.status as PendingActionStatus,
    decidedAt: row.decidedAt ? iso(row.decidedAt) : null,
    createdAt: iso(row.createdAt),
  };
}

function pendingQuery() {
  return db
    .select(pendingColumns)
    .from(agentPendingAction)
    .innerJoin(aiAgent, eq(aiAgent.id, agentPendingAction.agentId))
    .innerJoin(user, eq(user.id, aiAgent.userId));
}

export async function createPendingAction(input: {
  agentId: number;
  projectId: number;
  issueId: number | null;
  runId: number | null;
  tool: string;
  args: Record<string, unknown>;
}): Promise<number> {
  const [row] = await db
    .insert(agentPendingAction)
    .values(input)
    .returning({ id: agentPendingAction.id });
  return row!.id;
}

// Marks the held calls past PENDING_ACTION_TTL_MS as expired. It runs before every read
// and decision, so an expired call is never listed as pending or applied.
async function expirePendingActions() {
  await db
    .update(agentPendingAction)
    .set({ status: 'expired', decidedAt: new Date() })
    .where(
      and(
        eq(agentPendingAction.status, 'pending'),
        lt(agentPendingAction.createdAt, new Date(Date.now() - PENDING_ACTION_TTL_MS)),
      ),
    );
}

export async function listPendingActions(
  agentId: number,
  projectIds: number[] | null,
  status: PendingActionStatus | undefined,
  window: Window,
) {
  await expirePendingActions();
  const where = and(
    eq(agentPendingAction.agentId, agentId),
    status ? eq(agentPendingAction.status, status) : undefined,
    inProjects(agentPendingAction.projectId, projectIds),
  );
  const [rows, [total]] = await Promise.all([
    pendingQuery()
      .where(where)
      .orderBy(desc(agentPendingAction.createdAt), desc(agentPendingAction.id))
      .limit(window.limit)
      .offset(window.offset),
    db.select({ value: count() }).from(agentPendingAction).where(where),
  ]);
  return { items: rows.map(toPendingDto), total: total?.value ?? 0 };
}

// The calls on one issue still waiting for a decision. An issue holds few, so the
// list is whole.
export async function listIssuePendingActions(issueId: number) {
  await expirePendingActions();
  const rows = await pendingQuery()
    .where(and(eq(agentPendingAction.issueId, issueId), eq(agentPendingAction.status, 'pending')))
    .orderBy(agentPendingAction.createdAt, agentPendingAction.id);
  return rows.map(toPendingDto);
}

export async function getPendingActionProjectId(id: number): Promise<number | null> {
  const [row] = await db
    .select({ projectId: agentPendingAction.projectId })
    .from(agentPendingAction)
    .where(eq(agentPendingAction.id, id));
  return row?.projectId ?? null;
}

async function getPendingAction(id: number) {
  const [row] = await pendingQuery().where(eq(agentPendingAction.id, id));
  if (!row) throw new HttpError(404, 'Action not found');
  return toPendingDto(row);
}

// Moves a call out of 'pending'. The status condition makes it the claim: of two
// members deciding at once, one wins and the other gets 409, so a call is applied once.
async function decide(
  id: number,
  set: { status: PendingActionStatus; reason?: string },
  deciderId: string,
) {
  await expirePendingActions();
  const [claimed] = await db
    .update(agentPendingAction)
    .set({ ...set, decidedByUserId: deciderId, decidedAt: new Date() })
    .where(and(eq(agentPendingAction.id, id), eq(agentPendingAction.status, 'pending')))
    .returning();
  if (!claimed) throw new HttpError(409, 'Action was already decided or has expired');
  return claimed;
}

// Applies the call as the agent: a route call is dispatched with the agent's own key, so
// the route checks the agent's role, not the approver's; a custom call runs with the
// credential bound to the agent's tool. A refused call is kept as 'failed' with the
// answer. The row stays 'applying' until the outcome is written, so a process that stops
// in between leaves a row that says the call was never confirmed.
export async function approvePendingAction(id: number, deciderId: string) {
  const claimed = await decide(id, { status: 'applying' }, deciderId);
  const agent = await getAgentInProject(claimed.agentId, claimed.projectId);
  const outcome = agent
    ? await dispatchPending(agent, claimed.tool, claimed.args)
    : { text: 'The agent is no longer available', isError: true };
  await db
    .update(agentPendingAction)
    .set({ status: outcome.isError ? 'failed' : 'approved', result: outcome.text })
    .where(eq(agentPendingAction.id, id));
  await recordAgentAction({
    agentId: claimed.agentId,
    projectId: claimed.projectId,
    issueId: claimed.issueId,
    runId: claimed.runId,
    tool: claimed.tool,
    args: claimed.args,
    error: outcome.isError ? outcome.text : null,
    approvedByUserId: deciderId,
  });
  return getPendingAction(id);
}

async function dispatchPending(
  agent: AiAgentRow,
  tool: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const custom = await runPendingCustomTool(agent.id, tool, args);
  if (custom) return custom;
  const route = routeTools(getMcpApp()).find((r) => r.name === tool);
  if (!route) return { text: 'The tool is no longer available', isError: true };
  return dispatchTool(
    getMcpApp(),
    route,
    args,
    { kind: 'api-key', apiKey: await getInternalAgentApiKey(agent) },
    { viaMcpEndpoint: false },
  );
}

export async function rejectPendingAction(id: number, reason: string, deciderId: string) {
  await decide(id, { status: 'rejected', reason }, deciderId);
  return getPendingAction(id);
}

// The decisions on this agent's held calls in the project that the agent has not seen,
// as a block for the start of its next run. Reading them marks them reported, so each
// decision is shown to one run.
export async function takeDecisionsPreamble(agentId: number, projectId: number): Promise<string> {
  await expirePendingActions();
  const rows = await db
    .update(agentPendingAction)
    .set({ reportedAt: new Date() })
    .where(
      and(
        eq(agentPendingAction.agentId, agentId),
        eq(agentPendingAction.projectId, projectId),
        inArray(agentPendingAction.status, ['approved', 'rejected', 'failed', 'expired']),
        isNull(agentPendingAction.reportedAt),
      ),
    )
    .returning({
      id: agentPendingAction.id,
      tool: agentPendingAction.tool,
      status: agentPendingAction.status,
      reason: agentPendingAction.reason,
      result: agentPendingAction.result,
    });
  if (rows.length === 0) return '';
  const lines = rows
    .sort((a, b) => a.id - b.id)
    .map((row) => {
      const note =
        row.status === 'rejected' ? row.reason : row.status === 'failed' ? row.result : null;
      return `- Call #${row.id} (${row.tool}): ${row.status}${note ? `. ${note}` : ''}`;
    });
  return (
    'Decisions on the changes you proposed for approval since your last run. ' +
    'Do not propose a rejected change again unless the reason allows it:\n' +
    lines.join('\n') +
    '\n\n'
  );
}
