import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm';
import { aiAgent, db, hermesChatRun, hermesConversation, hermesMessage, user } from '@repo/db';
import { HttpError, iso, pgErrorCode } from '../shared/lib';

const WINDOW_MS = 60_000;
const CREATE_LIMIT = 10;
const MESSAGE_LIMIT = 30;

export interface HermesConversationRow {
  id: string;
  agentId: number;
  agentName: string;
  agentSlug: string;
  title: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

const conversationDto = (row: {
  id: string;
  agentId: number;
  agentName: string;
  agentSlug: string;
  title: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): HermesConversationRow => ({
  id: row.id,
  agentId: row.agentId,
  agentName: row.agentName,
  agentSlug: row.agentSlug,
  title: row.title,
  status: row.status as 'active' | 'archived',
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

export async function enforceConversationCreateRateLimit(projectId: number, userId: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ value: count() })
    .from(hermesConversation)
    .where(
      and(
        eq(hermesConversation.projectId, projectId),
        eq(hermesConversation.createdBy, userId),
        gt(hermesConversation.createdAt, since),
      ),
    );
  if ((row?.value ?? 0) >= CREATE_LIMIT) throw new HttpError(429, 'Too many conversations');
}

export async function enforceMessageRateLimit(projectId: number, userId: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ value: count() })
    .from(hermesChatRun)
    .innerJoin(hermesConversation, eq(hermesConversation.id, hermesChatRun.conversationId))
    .where(
      and(
        eq(hermesConversation.projectId, projectId),
        eq(hermesConversation.createdBy, userId),
        gt(hermesChatRun.createdAt, since),
      ),
    );
  if ((row?.value ?? 0) >= MESSAGE_LIMIT) throw new HttpError(429, 'Too many messages');
}

export async function insertHermesConversation(input: {
  projectId: number;
  userId: string;
  agentId: number;
  hermesAgentSlug: string;
  hermesSessionId: string;
  title: string | null;
}): Promise<HermesConversationRow> {
  const [row] = await db
    .insert(hermesConversation)
    .values({
      projectId: input.projectId,
      createdBy: input.userId,
      agentId: input.agentId,
      hermesAgentSlug: input.hermesAgentSlug,
      hermesSessionId: input.hermesSessionId,
      title: input.title,
    })
    .returning();
  const [agent] = await db
    .select({ name: user.name })
    .from(aiAgent)
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .where(eq(aiAgent.id, input.agentId))
    .limit(1);
  return conversationDto({
    ...row!,
    agentName: agent!.name,
    agentSlug: row!.hermesAgentSlug,
  });
}

export async function listHermesConversations(
  projectId: number,
  userId: string,
  agentId?: number,
): Promise<HermesConversationRow[]> {
  const where = [
    eq(hermesConversation.projectId, projectId),
    eq(hermesConversation.createdBy, userId),
    eq(hermesConversation.status, 'active'),
  ];
  if (agentId != null) where.push(eq(hermesConversation.agentId, agentId));
  const rows = await db
    .select({
      id: hermesConversation.id,
      agentId: hermesConversation.agentId,
      agentName: user.name,
      agentSlug: hermesConversation.hermesAgentSlug,
      title: hermesConversation.title,
      status: hermesConversation.status,
      createdAt: hermesConversation.createdAt,
      updatedAt: hermesConversation.updatedAt,
    })
    .from(hermesConversation)
    .innerJoin(aiAgent, eq(aiAgent.id, hermesConversation.agentId))
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .where(and(...where))
    .orderBy(desc(hermesConversation.updatedAt));
  return rows.map(conversationDto);
}

export async function getHermesConversation(id: string, projectId: number, userId: string) {
  const [row] = await db
    .select()
    .from(hermesConversation)
    .where(
      and(
        eq(hermesConversation.id, id),
        eq(hermesConversation.projectId, projectId),
        eq(hermesConversation.createdBy, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listHermesMessages(conversationId: string) {
  const rows = await db
    .select()
    .from(hermesMessage)
    .where(eq(hermesMessage.conversationId, conversationId))
    .orderBy(asc(hermesMessage.sequence));
  return rows
    .filter((row) => row.status !== 'pending')
    .map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      text: row.content,
      status: row.status as 'completed' | 'failed',
      createdAt: iso(row.createdAt),
    }));
}

export async function beginHermesRun(input: {
  conversationId: string;
  requestId: string;
  idempotencyKey: string;
  message: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(hermesChatRun)
        .values({
          conversationId: input.conversationId,
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();
      await tx.insert(hermesMessage).values({
        conversationId: input.conversationId,
        role: 'user',
        content: input.message,
      });
      const [assistant] = await tx
        .insert(hermesMessage)
        .values({ conversationId: input.conversationId, role: 'assistant', status: 'pending' })
        .returning();
      await tx
        .update(hermesConversation)
        .set({
          title: sql`coalesce(${hermesConversation.title}, ${input.message.slice(0, 120)})`,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hermesConversation.id, input.conversationId));
      return { runId: run!.id, assistantMessageId: assistant!.id };
    });
  } catch (error) {
    if (pgErrorCode(error) === '23505') throw new HttpError(409, 'Message already submitted');
    throw error;
  }
}

export async function completeHermesRun(input: {
  runId: string;
  assistantMessageId: string;
  content: string;
  hermesEventId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(hermesMessage)
      .set({
        content: input.content,
        hermesEventId: input.hermesEventId,
        status: 'completed',
      })
      .where(eq(hermesMessage.id, input.assistantMessageId));
    await tx
      .update(hermesChatRun)
      .set({
        status: 'completed',
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        completedAt: new Date(),
      })
      .where(eq(hermesChatRun.id, input.runId));
  });
}

export async function failHermesRun(
  runId: string,
  assistantMessageId: string,
  errorCode: string,
  content = '',
) {
  await db.transaction(async (tx) => {
    await tx
      .update(hermesMessage)
      .set({ status: 'failed', errorCode, content })
      .where(eq(hermesMessage.id, assistantMessageId));
    await tx
      .update(hermesChatRun)
      .set({ status: 'failed', errorCode, completedAt: new Date() })
      .where(eq(hermesChatRun.id, runId));
  });
}

export async function archiveHermesConversation(id: string, projectId: number, userId: string) {
  const [row] = await db
    .update(hermesConversation)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(
      and(
        eq(hermesConversation.id, id),
        eq(hermesConversation.projectId, projectId),
        eq(hermesConversation.createdBy, userId),
      ),
    )
    .returning({ id: hermesConversation.id });
  return row != null;
}
