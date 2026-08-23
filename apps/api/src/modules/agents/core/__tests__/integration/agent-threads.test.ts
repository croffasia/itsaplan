import { describe, it, expect, beforeEach } from 'bun:test';
import type { MastraMessagePart } from '@mastra/core/agent/message-list';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { ensureThread, buildMemory } from '../../runtime/memory';

// The chat-history endpoints:
//   GET /projects/:key/ai-agents/:agentId/threads             — the caller's own chat
//                                                               threads with the agent
//   GET .../ai-agents/:agentId/threads/:threadId/messages     — one thread's transcript
//   PATCH  .../ai-agents/:agentId/threads/:threadId           — rename one conversation
//   DELETE .../ai-agents/:agentId/threads/:threadId           — delete one conversation
//
// plus the thread scoping of a chat run: the thread id names the agent and the user it
// was issued to, and a run may only continue one of the caller's own.
//
// Chat threads live in Mastra's memory store (mastra_threads / mastra_messages),
// bound to their agent and owner via ensureThread. The runtime (a live LLM call)
// is not exercised: threads and messages are seeded directly through the memory
// module so the endpoints can be tested without a model.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner };
}

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

async function createInternalAgent(asOwner: Api, name: string, username: string) {
  const res = await agents(asOwner).post({ name, username, kind: 'internal' });
  return res.data!.agent;
}

// Seeds a chat thread owned by resourceId, bound to the agent, with an optional
// transcript. Mirrors what a real run persists (ensureThread up front, then the
// exchanged messages).
async function seedThread(
  threadId: string,
  resourceId: string,
  agent: { id: number; projectId: number },
  title: string,
  turns: Array<{ role: 'user' | 'assistant'; text: string; parts?: MastraMessagePart[] }> = [],
) {
  await ensureThread(
    threadId,
    resourceId,
    { agentId: agent.id, projectId: agent.projectId, kind: 'chat' },
    title,
  );
  if (turns.length === 0) return;
  const memory = buildMemory(20);
  let t = Date.now();
  await memory.saveMessages({
    messages: turns.map((turn) => ({
      id: crypto.randomUUID(),
      role: turn.role,
      type: 'text',
      threadId,
      resourceId,
      createdAt: new Date(t++),
      content: {
        format: 2 as const,
        parts: turn.parts ?? [{ type: 'text' as const, text: turn.text }],
        content: turn.text,
      },
    })),
  });
}

function textOf(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

// Moves a seeded thread a minute into the past. Threads seeded one after another are
// stamped with the same millisecond, and the history list orders by updatedAt, so
// without this the expected order is not the only one the endpoint may return.
async function backdateThread(threadId: string): Promise<void> {
  const memory = buildMemory(20);
  const thread = (await memory.getThreadById({ threadId }))!;
  const at = new Date(thread.updatedAt.getTime() - 60_000);
  await memory.saveThread({ thread: { ...thread, createdAt: at, updatedAt: at } });
}

// Whether the thread is still in the memory store. Deletion has no read endpoint of
// its own for a thread the caller does not own, so it is checked through the store.
async function threadExists(threadId: string): Promise<boolean> {
  return (await buildMemory(20).getThreadById({ threadId })) != null;
}

describe('agent chat history', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns an empty list for an agent with no threads', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    const res = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(res.status).toBe(200);
    expect(res.data!.items).toEqual([]);
  });

  it("lists the caller's threads for the agent, newest first, with the title", async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('t-old', owner.userId, agent, 'older question');
    await backdateThread('t-old');
    await seedThread('t-new', owner.userId, agent, 'newer question');

    const res = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(res.status).toBe(200);
    expect(res.data!.items.map((t) => t.id)).toEqual(['t-new', 't-old']);
    expect(res.data!.items[0]).toMatchObject({ id: 't-new', title: 'newer question' });
  });

  it('scopes threads to the requesting user', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    // A thread owned by someone else must not appear for the owner.
    await seedThread('mine', owner.userId, agent, 'mine');
    await seedThread('theirs', 'another-user-id', agent, 'theirs');

    const res = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(res.data!.items.map((t) => t.id)).toEqual(['mine']);
  });

  it('hands out the threads a page at a time, newest first', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    // One more than a page holds, so the last one falls onto the second page.
    for (let i = 0; i < 26; i++) await seedThread(`t-${i}`, owner.userId, agent, `question ${i}`);

    const first = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(first.data!.items).toHaveLength(25);
    expect(first.data!.nextPage).toBe(1);

    const second = await agents(asOwner)({ agentId: agent.id }).threads.get({ query: { page: 1 } });
    expect(second.data!.items).toHaveLength(1);
    expect(second.data!.nextPage).toBeNull();
    // No thread is on both pages.
    const ids = new Set([...first.data!.items, ...second.data!.items].map((t) => t.id));
    expect(ids.size).toBe(26);
  });

  it('scopes threads to the requested agent', async () => {
    const { owner, asOwner } = await setup();
    const a = await createInternalAgent(asOwner, 'Bot A', 'bota');
    const b = await createInternalAgent(asOwner, 'Bot B', 'botb');
    await seedThread('for-a', owner.userId, a, 'for a');

    const res = await agents(asOwner)({ agentId: b.id }).threads.get();
    expect(res.data!.items).toEqual([]);
    const resA = await agents(asOwner)({ agentId: a.id }).threads.get();
    expect(resA.data!.items.map((t) => t.id)).toEqual(['for-a']);
  });

  it('404s the thread list for an agent that does not exist', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 }).threads.get();
    expect(res.status).toBe(404);
  });

  it('400s the thread list for a non-numeric agent id', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 'abc' }).threads.get();
    expect(res.status).toBe(400);
  });

  it('denies a non-member the thread list with 403', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const outsider = await signUpTestUser({ name: 'Outsider' });

    const res = await agents(authedApi(outsider.cookie))({ agentId: agent.id }).threads.get();
    expect(res.status).toBe(403);
  });

  it("returns a thread's transcript, mapping roles and text", async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('t1', owner.userId, agent, 'hello', [
      { role: 'user', text: 'list 5 posts' },
      { role: 'assistant', text: 'here they are' },
    ]);

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 't1' })
      .messages.get();
    expect(res.status).toBe(200);
    expect(res.data!.items.map((m) => ({ role: m.role, parts: m.parts }))).toEqual([
      { role: 'user', parts: [{ type: 'text', text: 'list 5 posts' }] },
      { role: 'assistant', parts: [{ type: 'text', text: 'here they are' }] },
    ]);
    expect(res.data!.items.every((message) => !Number.isNaN(Date.parse(message.createdAt)))).toBe(
      true,
    );
    expect(res.data!.nextPage).toBeNull();
  });

  it('keeps a tool call between the stretches of text around it', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('t-tools', owner.userId, agent, 'tools', [
      { role: 'user', text: 'what is left?' },
      {
        role: 'assistant',
        text: 'Looking.Two things.',
        parts: [
          { type: 'text', text: 'Looking.' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'list_issues',
              args: { status: 'open', __mastraMetadata: { runId: 'r1' } },
              state: 'result',
              result: 'two',
            },
          },
          { type: 'text', text: 'Two things.' },
        ],
      },
    ]);

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 't-tools' })
      .messages.get();
    expect(res.status).toBe(200);
    expect(res.data!.items[1]!.parts).toEqual([
      { type: 'text', text: 'Looking.' },
      {
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'list_issues',
        args: '{"status":"open"}',
        result: 'two',
      },
      { type: 'text', text: 'Two things.' },
    ]);
  });

  it('returns an empty transcript for an owned thread with no messages', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('empty', owner.userId, agent, 'empty');

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'empty' })
      .messages.get();
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ items: [], nextPage: null });
  });

  it('paginates a transcript from the newest messages', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const turns = Array.from({ length: 27 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `message ${index}`,
    }));
    await seedThread('long', owner.userId, agent, 'long', turns);

    const latest = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'long' })
      .messages.get();
    expect(latest.status).toBe(200);
    expect(latest.data!.items).toHaveLength(25);
    expect(textOf(latest.data!.items[0]!)).toBe('message 2');
    expect(textOf(latest.data!.items[24]!)).toBe('message 26');
    expect(latest.data!.nextPage).toBe(1);

    const earlier = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'long' })
      .messages.get({ query: { page: 1 } });
    expect(earlier.status).toBe(200);
    expect(earlier.data!.items.map(textOf)).toEqual(['message 0', 'message 1']);
    expect(earlier.data!.nextPage).toBeNull();
  });

  it('404s a thread that does not exist', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'nope' })
      .messages.get();
    expect(res.status).toBe(404);
  });

  it('404s a thread owned by another user (no cross-user read)', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('theirs', 'another-user-id', agent, 'theirs', [
      { role: 'user', text: 'secret' },
    ]);

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'theirs' })
      .messages.get();
    expect(res.status).toBe(404);
  });

  it("renames the caller's thread", async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('mine', owner.userId, agent, 'Untitled');

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'mine' })
      .patch({ title: 'Release plan' });
    expect(res.status).toBe(204);

    const list = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(list.data!.items[0].title).toBe('Release plan');
  });

  it("404s renaming another user's thread", async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('theirs', 'another-user-id', agent, 'theirs');

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'theirs' })
      .patch({ title: 'Mine now' });
    expect(res.status).toBe(404);
  });

  it("deletes the caller's thread with its messages", async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('mine', owner.userId, agent, 'mine', [{ role: 'user', text: 'hello' }]);

    const res = await agents(asOwner)({ agentId: agent.id }).threads({ threadId: 'mine' }).delete();
    expect(res.status).toBe(204);

    const list = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(list.data!.items).toEqual([]);
    const messages = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'mine' })
      .messages.get();
    expect(messages.status).toBe(404);
  });

  it("404s deleting another user's thread, leaving it readable for its owner", async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('theirs', 'another-user-id', agent, 'theirs', [
      { role: 'user', text: 'secret' },
    ]);

    const res = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'theirs' })
      .delete();
    expect(res.status).toBe(404);
    expect(await threadExists('theirs')).toBe(true);
  });

  it('404s deleting a thread that does not exist', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    const res = await agents(asOwner)({ agentId: agent.id }).threads({ threadId: 'nope' }).delete();
    expect(res.status).toBe(404);
  });

  it('denies a non-member the delete with 403', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('mine', owner.userId, agent, 'mine');
    const outsider = await signUpTestUser({ name: 'Outsider' });

    const res = await agents(authedApi(outsider.cookie))({ agentId: agent.id })
      .threads({ threadId: 'mine' })
      .delete();
    expect(res.status).toBe(403);
    expect(await threadExists('mine')).toBe(true);
  });

  it("404s a run continuing another user's chat thread", async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread(`chat:${agent.id}:another-user-id:t1`, 'another-user-id', agent, 'theirs');

    const res = await agents(asOwner)({ agentId: agent.id }).run.post({
      prompt: 'what did they ask?',
      threadId: `chat:${agent.id}:another-user-id:t1`,
    });
    expect(res.status).toBe(404);
  });

  it("404s a streamed run continuing another user's chat thread", async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread(`chat:${agent.id}:another-user-id:t1`, 'another-user-id', agent, 'theirs');

    const res = await agents(asOwner)({ agentId: agent.id }).run.stream.post({
      prompt: 'what did they ask?',
      threadId: `chat:${agent.id}:another-user-id:t1`,
    });
    expect(res.status).toBe(404);
  });

  it("404s a run continuing another agent's chat thread of the same user", async () => {
    const { owner, asOwner } = await setup();
    const a = await createInternalAgent(asOwner, 'Bot A', 'bota');
    const b = await createInternalAgent(asOwner, 'Bot B', 'botb');
    await seedThread(`chat:${a.id}:${owner.userId}:t1`, owner.userId, a, 'with a');

    const res = await agents(asOwner)({ agentId: b.id }).run.post({
      prompt: 'what did I ask A?',
      threadId: `chat:${a.id}:${owner.userId}:t1`,
    });
    expect(res.status).toBe(404);
  });

  it('404s a run handed the thread of an autonomous run', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    for (const threadId of [`issue:1:${agent.id}`, 'schedule:1', 'run:1']) {
      const res = await agents(asOwner)({ agentId: agent.id }).run.post({
        prompt: 'what did you do?',
        threadId,
      });
      expect(res.status).toBe(404);
    }
  });

  it("accepts the caller's own chat thread id and fails later on the model config", async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    // The agent has no model credential, so the run stops at 400 — past the thread
    // check, which is what this asserts.
    const res = await agents(asOwner)({ agentId: agent.id }).run.post({
      prompt: 'hello',
      threadId: `chat:${agent.id}:${owner.userId}:t1`,
    });
    expect(res.status).toBe(400);
  });
});
