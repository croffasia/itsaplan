import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';
import { createChatThread, buildMemory } from '../../runtime/memory';

// The chat-history endpoints:
//   GET /projects/:key/ai-agents/:agentId/threads             — the caller's own chat
//                                                               threads with the agent
//   GET .../ai-agents/:agentId/threads/:threadId/messages     — one thread's transcript
//
// Chat threads live in Mastra's memory store (mastra_threads / mastra_messages),
// bound to their agent and owner via createChatThread. The runtime (a live LLM call)
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
// transcript. Mirrors what a real run persists (createChatThread up front, then the
// exchanged messages).
async function seedThread(
  threadId: string,
  resourceId: string,
  agent: { id: number; projectId: number },
  title: string,
  turns: Array<{ role: 'user' | 'assistant'; text: string }> = [],
) {
  await createChatThread(
    threadId,
    resourceId,
    { agentId: agent.id, projectId: agent.projectId },
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
        parts: [{ type: 'text' as const, text: turn.text }],
        content: turn.text,
      },
    })),
  });
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
    expect(res.data).toEqual([]);
  });

  it("lists the caller's threads for the agent, newest first, with the title", async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await seedThread('t-old', owner.userId, agent, 'older question');
    await seedThread('t-new', owner.userId, agent, 'newer question');

    const res = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(res.status).toBe(200);
    expect(res.data!.map((t) => t.id)).toEqual(['t-new', 't-old']);
    expect(res.data![0]).toMatchObject({ id: 't-new', title: 'newer question' });
  });

  it('scopes threads to the requesting user', async () => {
    const { owner, asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    // A thread owned by someone else must not appear for the owner.
    await seedThread('mine', owner.userId, agent, 'mine');
    await seedThread('theirs', 'another-user-id', agent, 'theirs');

    const res = await agents(asOwner)({ agentId: agent.id }).threads.get();
    expect(res.data!.map((t) => t.id)).toEqual(['mine']);
  });

  it('scopes threads to the requested agent', async () => {
    const { owner, asOwner } = await setup();
    const a = await createInternalAgent(asOwner, 'Bot A', 'bota');
    const b = await createInternalAgent(asOwner, 'Bot B', 'botb');
    await seedThread('for-a', owner.userId, a, 'for a');

    const res = await agents(asOwner)({ agentId: b.id }).threads.get();
    expect(res.data).toEqual([]);
    const resA = await agents(asOwner)({ agentId: a.id }).threads.get();
    expect(resA.data!.map((t) => t.id)).toEqual(['for-a']);
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
    expect(res.data!.items.map((m) => ({ role: m.role, text: m.text }))).toEqual([
      { role: 'user', text: 'list 5 posts' },
      { role: 'assistant', text: 'here they are' },
    ]);
    expect(res.data!.items.every((message) => !Number.isNaN(Date.parse(message.createdAt)))).toBe(
      true,
    );
    expect(res.data!.nextPage).toBeNull();
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
    expect(latest.data!.items[0]!.text).toBe('message 2');
    expect(latest.data!.items[24]!.text).toBe('message 26');
    expect(latest.data!.nextPage).toBe(1);

    const earlier = await agents(asOwner)({ agentId: agent.id })
      .threads({ threadId: 'long' })
      .messages.get({ query: { page: 1 } });
    expect(earlier.status).toBe(200);
    expect(earlier.data!.items.map((message) => message.text)).toEqual(['message 0', 'message 1']);
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
});
