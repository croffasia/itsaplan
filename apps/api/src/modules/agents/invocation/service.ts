import { db, aiAgent, agentChatMessage, agentRun } from '@repo/db';
import { and, eq, inArray, isNotNull, lte, or, sql, exists } from 'drizzle-orm';
import { signPayload } from '@repo/crypto';
import { pinnedFetch } from '@repo/net';
import { intEnv } from '#shared/lib';
import {
  agentRunConfig,
  markRunFailed,
  runRetryDelayMs,
  scheduleRunRetry,
} from '../core/run-queue';
import { recordAgentRunFinished } from '../core/run-activity';
import { getRunnerAgent, takeNextRun, type RunnerAgent, type RunnerRun } from '../runner/service';
import { finishMessage, takeNextMessage, type ClaimedChat } from '../chat/service';
import { readInvocationSecret } from './secret';

// Sends an external agent its work when it has an invocation URL. The work is claimed
// with the runner's own claims, so a run sent here is framed, leased and admitted the
// same way, and the endpoint reports progress and the result through the runner routes
// with the agent's API key. The request only hands the work over: a 2xx means the
// endpoint took it.

export const agentInvocationConfig = {
  pollIntervalMs: () => intEnv('AGENT_INVOCATION_POLL_INTERVAL_MS', 1000),
  timeoutMs: () => intEnv('AGENT_INVOCATION_TIMEOUT_MS', 15_000),
};

type InvocationEvent = 'agent.run' | 'agent.chat' | 'ping';

// The receiver's response body, cut to what the test result shows.
const MAX_RESPONSE_CHARS = 2000;

export interface InvocationOutcome {
  ok: boolean;
  // No answer in time. The endpoint may still be working on the request, so the work
  // stays under its lease instead of being sent again at once.
  timedOut: boolean;
  status: number | null;
  error: string | null;
  responseBody: string | null;
  durationMs: number;
}

interface Target {
  url: string;
  secret: string;
}

async function targetOf(agent: {
  id: number;
  invocationUrl: string | null;
}): Promise<Target | null> {
  if (!agent.invocationUrl) return null;
  const secret = await readInvocationSecret(agent.id);
  return secret ? { url: agent.invocationUrl, secret } : null;
}

async function invoke(
  target: Target,
  event: InvocationEvent,
  agent: { id: number; username: string },
  data: Record<string, unknown>,
): Promise<InvocationOutcome> {
  const body = JSON.stringify({
    event,
    agent: { id: agent.id, username: agent.username },
    apiUrl: (process.env.API_URL ?? '').replace(/\/+$/, '') || null,
    ...data,
  });
  const timeoutMs = agentInvocationConfig.timeoutMs();
  const signal = AbortSignal.timeout(timeoutMs);
  const started = Date.now();
  try {
    const res = await pinnedFetch(target.url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'itsaplan-agents/1',
        'X-Itsaplan-Event': event,
        'X-Itsaplan-Signature': signPayload(target.secret, Math.floor(started / 1000), body),
      },
      body,
      maxBytes: MAX_RESPONSE_CHARS * 4,
      truncateBody: true,
    });
    const text = (await res.text().catch(() => '')).slice(0, MAX_RESPONSE_CHARS);
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      timedOut: false,
      status: res.status,
      error: ok ? null : `The endpoint answered ${res.status}`,
      responseBody: text || null,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const timedOut = signal.aborted;
    let error: string;
    if (timedOut) error = `No answer within ${Math.round(timeoutMs / 1000)}s`;
    else error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      timedOut,
      status: null,
      error,
      responseBody: null,
      durationMs: Date.now() - started,
    };
  }
}

// Sends a ping, so whoever sets the URL up sees whether the endpoint answers and
// accepts the signature before real work goes there. Null when the agent has no URL.
export async function testInvocation(agent: {
  id: number;
  username: string;
  invocationUrl: string | null;
}): Promise<InvocationOutcome | null> {
  const target = await targetOf(agent);
  if (!target) return null;
  return invoke(target, 'ping', agent, {});
}

// The bot users of the agents with an invocation URL that have a run or a chat answer
// due. The secret is issued with the URL, so an agent without one is left out rather
// than sent unsigned requests.
async function agentsWithDueWork(): Promise<string[]> {
  const dueRun = db
    .select({ id: agentRun.id })
    .from(agentRun)
    .where(
      and(
        eq(agentRun.agentId, aiAgent.id),
        eq(agentRun.status, 'pending'),
        lte(agentRun.nextAttemptAt, sql`now()`),
      ),
    );
  const dueAnswer = db
    .select({ id: agentChatMessage.id })
    .from(agentChatMessage)
    .where(
      and(
        eq(agentChatMessage.agentId, aiAgent.id),
        eq(agentChatMessage.role, 'assistant'),
        inArray(agentChatMessage.status, ['pending', 'streaming']),
        lte(agentChatMessage.nextAttemptAt, sql`now()`),
      ),
    );
  const rows = await db
    .select({ userId: aiAgent.userId })
    .from(aiAgent)
    .where(
      and(
        eq(aiAgent.kind, 'external'),
        isNotNull(aiAgent.invocationUrl),
        isNotNull(aiAgent.invocationSecretCiphertext),
        or(exists(dueRun), exists(dueAnswer)),
      ),
    );
  return rows.map((row) => row.userId);
}

// Claims up to a batch of items one at a time, so the requests for them can be sent
// together.
async function takeBatch<T>(take: () => Promise<T | null>): Promise<T[]> {
  const items: T[] = [];
  for (let i = 0; i < agentRunConfig.batchSize(); i++) {
    const item = await take();
    if (!item) break;
    items.push(item);
  }
  return items;
}

// A run the endpoint refused is retried like a failed attempt of an internal agent's
// run, and the last refusal fails it.
async function sendRun(agent: RunnerAgent, target: Target, run: RunnerRun): Promise<void> {
  const outcome = await invoke(target, 'agent.run', agent, { run });
  if (outcome.ok || outcome.timedOut) return;
  const error = outcome.error ?? 'The endpoint refused the run';
  if (run.attempts < agentRunConfig.maxAttempts()) {
    await scheduleRunRetry(run.id, runRetryDelayMs(run.attempts), error);
    return;
  }
  await recordAgentRunFinished({ issueId: run.issueId, agentUserId: agent.userId }, 'failed');
  await markRunFailed(run.id, error);
}

// A person is waiting for the answer, so a refusal fails it at once instead of after
// the retries a run gets.
async function sendChat(agent: RunnerAgent, target: Target, message: ClaimedChat): Promise<void> {
  const outcome = await invoke(target, 'agent.chat', agent, { message });
  if (outcome.ok || outcome.timedOut) return;
  await finishMessage(agent.id, message.id, { status: 'failed', error: outcome.error });
}

async function dispatchAgent(userId: string): Promise<void> {
  const agent = await getRunnerAgent(userId);
  if (!agent) return;
  const target = await targetOf(agent);
  if (!target) return;
  const runs = await takeBatch(() => takeNextRun(agent));
  const messages = await takeBatch(() => takeNextMessage(agent));
  await Promise.all([
    ...runs.map((run) => sendRun(agent, target, run)),
    ...messages.map((message) => sendChat(agent, target, message)),
  ]);
}

// The bot users of the agents whose requests are still out. A pass skips them, so an
// agent is not sent a second batch while its endpoint is still answering the first.
const dispatching = new Set<string>();

export async function dispatchInvocations(): Promise<void> {
  const userIds = (await agentsWithDueWork()).filter((userId) => !dispatching.has(userId));
  await Promise.all(
    userIds.map(async (userId) => {
      dispatching.add(userId);
      try {
        await dispatchAgent(userId);
      } finally {
        dispatching.delete(userId);
      }
    }),
  );
}
