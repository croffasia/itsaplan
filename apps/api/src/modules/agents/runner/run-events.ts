import { db, agentRun, agentRunTrace, issue } from '@repo/db';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { runDocumentVisibleTo } from '../core/run-queue';
import type { AgUiEventBody } from '../model';

const MAX_EVENTS = 2000;
const MAX_BYTES = 1_000_000;

export async function appendRunEvents(
  agentId: number,
  runId: number,
  input: {
    attempt: number;
    offset: number;
    events: AgUiEventBody[];
    sessionId?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(agentRun)
      .where(
        and(
          eq(agentRun.id, runId),
          eq(agentRun.agentId, agentId),
          eq(agentRun.status, 'pending'),
          eq(agentRun.attempts, input.attempt),
          sql`${agentRun.executionStartedAt} IS NOT NULL AND ${agentRun.nextAttemptAt} > now()`,
        ),
      )
      .for('update');
    if (!run) throw new HttpError(404, 'Active run attempt not found');
    await tx.insert(agentRunTrace).values({ runId, attempt: input.attempt }).onConflictDoNothing();
    const key = and(eq(agentRunTrace.runId, runId), eq(agentRunTrace.attempt, input.attempt));
    const [trace] = await tx.select().from(agentRunTrace).where(key);
    if (input.offset < trace.nextOffset && input.offset + input.events.length <= trace.nextOffset) {
      return { nextOffset: trace.nextOffset, truncated: trace.truncated };
    }
    if (input.offset !== trace.nextOffset) throw new HttpError(409, 'Unexpected trace offset');
    if (trace.sessionId && input.sessionId && trace.sessionId !== input.sessionId) {
      throw new HttpError(409, 'Session is already bound to this attempt');
    }
    const events = trace.events as { event: AgUiEventBody; receivedAt: string }[];
    let bytes = Buffer.byteLength(JSON.stringify(events));
    let truncated = trace.truncated;
    const receivedAt = new Date().toISOString();
    for (const event of input.events) {
      const stored = { event, receivedAt };
      const size = Buffer.byteLength(JSON.stringify(stored)) + 1;
      if (truncated || events.length >= MAX_EVENTS || bytes + size > MAX_BYTES) {
        truncated = true;
        continue;
      }
      events.push(stored);
      bytes += size;
    }
    const nextOffset = input.offset + input.events.length;
    await tx
      .update(agentRunTrace)
      .set({
        events,
        nextOffset,
        truncated,
        sessionId: trace.sessionId ?? input.sessionId ?? null,
      })
      .where(key);
    await tx.execute(sql`SELECT bump_rev(${'runner-queue:' + run.projectId}, ${run.projectId})`);
    return { nextOffset, truncated };
  });
}

// The project of a run whose transcript the viewer asks for, and the document it was
// started in, if any.
export async function visibleRun(runId: number, viewerId: string) {
  const [row] = await db
    .select({ projectId: agentRun.projectId, documentId: agentRun.documentId })
    .from(agentRun)
    .leftJoin(issue, eq(issue.id, agentRun.issueId))
    .where(
      and(
        eq(agentRun.id, runId),
        or(isNull(agentRun.issueId), eq(issue.projectId, agentRun.projectId)),
        runDocumentVisibleTo(viewerId),
      ),
    );
  return row;
}

export async function readRunTrace(projectId: number, runId: number, attempt?: number) {
  const [row] = await db
    .select({ trace: agentRunTrace })
    .from(agentRunTrace)
    .innerJoin(agentRun, eq(agentRun.id, agentRunTrace.runId))
    .leftJoin(issue, eq(issue.id, agentRun.issueId))
    .where(
      and(
        eq(agentRun.id, runId),
        eq(agentRun.projectId, projectId),
        or(isNull(agentRun.issueId), eq(issue.projectId, projectId)),
        attempt == null ? undefined : eq(agentRunTrace.attempt, attempt),
      ),
    )
    .orderBy(desc(agentRunTrace.attempt))
    .limit(1);
  if (!row) return attempt == null ? null : undefined;
  const trace = row.trace;
  const [previous] = await db
    .select({ attempt: agentRunTrace.attempt })
    .from(agentRunTrace)
    .where(and(eq(agentRunTrace.runId, runId), lt(agentRunTrace.attempt, trace.attempt)))
    .orderBy(desc(agentRunTrace.attempt))
    .limit(1);
  return {
    attempt: trace.attempt,
    previousAttempt: previous?.attempt ?? null,
    sessionId: trace.sessionId,
    sessionUrl: trace.sessionId ? `codex://threads/${trace.sessionId}` : null,
    truncated: trace.truncated,
    events: trace.events,
  };
}
