import { db, agentRun, aiAgent, issue } from '@repo/db';
import { and, desc, eq, lt } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { contextTokensOf } from '#modules/agents/core/run-queue';
import { getRunTrace } from '#modules/agents/core/runtime/traces';

export async function listIssueAgentRuns(issueId: number, before?: number, limit = 25) {
  const rows = await db
    .select({
      id: agentRun.id,
      agentId: agentRun.agentId,
      username: aiAgent.username,
      kind: aiAgent.kind,
      status: agentRun.status,
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
    })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .innerJoin(issue, eq(issue.id, agentRun.issueId))
    .where(
      and(
        eq(issue.id, issueId),
        // A moved issue does not grant access to prompts from its former project.
        eq(agentRun.projectId, issue.projectId),
        before == null ? undefined : lt(agentRun.id, before),
      ),
    )
    .orderBy(desc(agentRun.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ inputTokens, outputTokens, ...row }) => ({
      ...row,
      ...contextTokensOf({ inputTokens, outputTokens }),
      createdAt: iso(row.createdAt),
      startedAt: row.startedAt ? iso(row.startedAt) : null,
      finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
      nextAttemptAt: iso(row.nextAttemptAt),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getIssueAgentRunTrace(issueId: number, runId: number, viewerId: string) {
  const [run] = await db
    .select({ agentId: agentRun.agentId, projectId: agentRun.projectId })
    .from(agentRun)
    .innerJoin(issue, eq(issue.id, agentRun.issueId))
    .where(
      and(eq(agentRun.id, runId), eq(issue.id, issueId), eq(agentRun.projectId, issue.projectId)),
    );
  if (!run) return undefined;
  return getRunTrace(run.agentId, runId, run.projectId, issueId, viewerId);
}
