import { describe, it, expect, beforeEach } from 'bun:test';
import { app, apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';

// Chatting with an external agent: a member sends a message, the agent's runner claims
// it, reports what its command produces as AG-UI events, and closes it. The claim waits
// for work on the server, so the wait is shortened here — otherwise every empty-feed
// assertion would sit out the full production wait.
process.env.AGENT_CHAT_CLAIM_WAIT_MS = '50';
process.env.AGENT_CHAT_CLAIM_POLL_MS = '10';

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const created = await asOwner.projects({ projectKey: 'MKT' })['ai-agents'].post({
    name: 'Ext Bot',
    username: 'ext',
    kind: 'external',
  });
  return {
    owner,
    asOwner,
    agent: created.data!.agent,
    asRunner: apiKeyApi(created.data!.apiKey!),
  };
}

function chatOf(api: Api, agentId: number) {
  return api.projects({ projectKey: 'MKT' })['ai-agents']({ agentId });
}

function send(api: Api, agentId: number, prompt: string, threadId?: string) {
  return chatOf(api, agentId).chat.post(threadId ? { prompt, threadId } : { prompt });
}

// Claims the agent's queued answer and closes it with the given text, the way a runner
// does, so the conversation carries a reply the search can match.
async function answer(asRunner: Api, text: string) {
  const claimed = (await asRunner['agent-chats'].claim.post()).data!.message!;
  await asRunner['agent-chats']({ messageId: claimed.id }).events.post({
    events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: text }],
  });
  await asRunner['agent-chats']({ messageId: claimed.id }).result.post({ status: 'success' });
}

// The stream is a raw Response rather than a JSON body, so it is driven through the
// app directly: Treaty has nothing to hand back for an event stream.
async function readStream(
  cookie: string,
  agentId: number,
  messageId: number,
): Promise<{ status: number; frames: string[] }> {
  const res = await app.handle(
    new Request(`http://localhost/projects/MKT/ai-agents/${agentId}/chat/${messageId}/stream`, {
      headers: { cookie },
    }),
  );
  if (!res.body) return { status: res.status, frames: [] };
  const text = await new Response(res.body).text();
  return { status: res.status, frames: text.split('\n\n').filter(Boolean) };
}

describe('external agent chat', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('queues an answer the runner claims with the message framed as its task', async () => {
    const { asOwner, asRunner, agent } = await setup();

    const sent = await send(asOwner, agent.id, 'What is left for the launch?');
    expect(sent.status).toBe(200);
    expect(sent.data!.threadId).toStartWith(`chat:${agent.id}:`);

    const claimed = await asRunner['agent-chats'].claim.post();
    expect(claimed.status).toBe(200);
    expect(claimed.data!.message).toMatchObject({
      id: sent.data!.messageId,
      threadId: sent.data!.threadId,
      attempts: 1,
    });
    expect(claimed.data!.message!.prompt).toContain('What is left for the launch?');
    // A chat is the opposite of an autonomous run: someone is waiting, and the agent
    // is told so along with the project it works in.
    expect(claimed.data!.message!.systemPrompt).toContain('Run mode');
    expect(claimed.data!.message!.systemPrompt).toContain('Marketing');
  });

  it("mixes the agent's own instructions into the system prompt", async () => {
    const { asOwner, asRunner, agent } = await setup();
    await chatOf(asOwner, agent.id).patch({ instructions: 'Always answer in German.' });
    await send(asOwner, agent.id, 'Status?');

    const claimed = await asRunner['agent-chats'].claim.post();
    expect(claimed.data!.message!.systemPrompt).toContain('Always answer in German.');
  });

  it('carries the conversation so far into the next task', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const first = await send(asOwner, agent.id, 'Who owns the launch?');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Maria does.' }],
    });
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({ status: 'success' });

    await send(asOwner, agent.id, 'And the launch date?', first.data!.threadId);
    const second = (await asRunner['agent-chats'].claim.post()).data!.message!;
    expect(second.threadId).toBe(first.data!.threadId);
    expect(second.prompt).toContain('Who owns the launch?');
    expect(second.prompt).toContain('Maria does.');
    expect(second.prompt).toContain('And the launch date?');
  });

  it('returns nothing when the feed is empty', async () => {
    const { asRunner } = await setup();
    const res = await asRunner['agent-chats'].claim.post();
    expect(res.status).toBe(200);
    expect(res.data!.message).toBeNull();
  });

  // A thread bound to a session on the runner's machine is sent only the new message:
  // that session holds the rest, in fuller form than this transcript keeps it.
  it('sends only the new message once the thread is bound to a session', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const first = await send(asOwner, agent.id, 'Who owns the launch?');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    expect(answer.sessionId).toBeNull();

    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Maria does.' }],
      sessionId: 'sess-abc',
    });
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({ status: 'success' });

    await send(asOwner, agent.id, 'And the launch date?', first.data!.threadId);
    const second = (await asRunner['agent-chats'].claim.post()).data!.message!;
    expect(second.sessionId).toBe('sess-abc');
    expect(second.prompt).toBe('And the launch date?');
    expect(second.prompt).not.toContain('Who owns the launch?');
    // The session was started with it, so repeating it would only cost context.
    expect(second.systemPrompt).toBe('');
  });

  it('keeps the session a thread was first bound to', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Status?');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    const events = { events: [{ type: 'RUN_STARTED' as const }] };

    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      ...events,
      sessionId: 'sess-first',
    });
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      ...events,
      sessionId: 'sess-second',
    });

    const threads = await chatOf(asOwner, agent.id).threads.get();
    expect(threads.data!.items.find((t) => t.id === sent.data!.threadId)!.cliSessionId).toBe(
      'sess-first',
    );
  });

  it('shows the bound session in the thread list, and none for a fresh thread', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Status?');

    const before = await chatOf(asOwner, agent.id).threads.get();
    expect(before.data!.items.find((t) => t.id === sent.data!.threadId)!.cliSessionId).toBeNull();

    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'RUN_STARTED' }],
      sessionId: 'sess-abc',
    });

    const after = await chatOf(asOwner, agent.id).threads.get();
    expect(after.data!.items.find((t) => t.id === sent.data!.threadId)!.cliSessionId).toBe(
      'sess-abc',
    );
  });

  // The runner is what measures the context size, so the thread list is where the member
  // reads it back.
  it('keeps the context size the runner reported with the answer', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Status?');

    const fresh = await chatOf(asOwner, agent.id).threads.get();
    expect(fresh.data!.items[0].contextTokens).toBeUndefined();

    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({
      status: 'success',
      usage: { inputTokens: 44_945, outputTokens: 300 },
    });

    const answered = await chatOf(asOwner, agent.id).threads.get();
    expect(answered.data!.items.find((t) => t.id === sent.data!.threadId)!.contextTokens).toBe(
      45_245,
    );

    // Every answer replaces the number: only the last one says how large the context is.
    await send(asOwner, agent.id, 'And now?', sent.data!.threadId);
    const second = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: second.id }).result.post({
      status: 'success',
      usage: { inputTokens: 50_000, outputTokens: 100 },
    });

    const again = await chatOf(asOwner, agent.id).threads.get();
    expect(again.data!.items.find((t) => t.id === sent.data!.threadId)!.contextTokens).toBe(50_100);
  });

  it('tells a command that reports no counts apart from a runner that reports none', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Status?');

    // An older runner sends no field at all: the answer is stored with no number and no
    // error.
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    const closed = await asRunner['agent-chats']({ messageId: answer.id }).result.post({
      status: 'success',
    });
    expect(closed.status).toBe(204);
    const silent = await chatOf(asOwner, agent.id).threads.get();
    expect(silent.data!.items[0].contextTokens).toBeUndefined();

    // A runner whose command has no usable counts says so with null, which the chat
    // shows as a dash.
    await send(asOwner, agent.id, 'And now?', sent.data!.threadId);
    const second = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: second.id }).result.post({
      status: 'success',
      usage: null,
    });

    const dashed = await chatOf(asOwner, agent.id).threads.get();
    expect(dashed.data!.items.find((t) => t.id === sent.data!.threadId)!.contextTokens).toBeNull();
  });

  it('keeps the counts of an answer that failed', async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Status?');

    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({
      status: 'failed',
      error: 'Command exited with 1',
      usage: { inputTokens: 900, outputTokens: 100 },
    });

    const threads = await chatOf(asOwner, agent.id).threads.get();
    expect(threads.data!.items[0].contextTokens).toBe(1000);
  });

  it('drops the context size with the thread', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Status?');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({
      status: 'success',
      usage: { inputTokens: 100, outputTokens: 10 },
    });

    expect(
      (await chatOf(asOwner, agent.id).threads({ threadId: sent.data!.threadId }).delete()).status,
    ).toBe(204);

    // The next thread takes ids of its own, so nothing is left to inherit the number: it
    // is gone with the thread it belonged to.
    const after = await chatOf(asOwner, agent.id).threads.get();
    expect(after.data!.items).toHaveLength(0);
  });

  it('hands a claimed answer to no one else until its lease expires', async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Hello');

    expect((await asRunner['agent-chats'].claim.post()).data!.message).not.toBeNull();
    expect((await asRunner['agent-chats'].claim.post()).data!.message).toBeNull();
  });

  it('reports events back with a cursor and builds the answer text from them', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Summarise the sprint');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;

    const reported = await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [
        { type: 'RUN_STARTED' },
        { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Two things ' },
        { type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'list_issues' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"status":' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '"open"}' },
        { type: 'TOOL_CALL_END', toolCallId: 't1' },
        { type: 'TOOL_CALL_RESULT', messageId: 'm1', toolCallId: 't1', content: '2 issues' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'are left.' },
      ],
    });
    expect(reported.status).toBe(200);
    expect(reported.data).toEqual({ canceled: false });

    const events = await chatOf(asOwner, agent.id).chat({ messageId: answer.id }).events.get();
    expect(events.status).toBe(200);
    expect(events.data!.status).toBe('streaming');
    expect(events.data!.items.map((item) => item.event.type)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
      'TEXT_MESSAGE_CONTENT',
    ]);

    // Reading again from the cursor returns only what arrived after it.
    const cursor = events.data!.nextCursor!;
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'RUN_FINISHED' }],
    });
    const later = await chatOf(asOwner, agent.id)
      .chat({ messageId: answer.id })
      .events.get({ query: { after: cursor } });
    expect(later.data!.items.map((item) => item.event.type)).toEqual(['RUN_FINISHED']);

    await asRunner['agent-chats']({ messageId: answer.id }).result.post({ status: 'success' });
    const transcript = await chatOf(asOwner, agent.id)
      .threads({ threadId: sent.data!.threadId })
      .messages.get();
    // The tool the runner reported stays where it was called: between the text before
    // it and the text after it, with the arguments it was given and what it answered.
    expect(transcript.data!.items).toMatchObject([
      { role: 'user', parts: [{ type: 'text', text: 'Summarise the sprint' }] },
      {
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Two things ' },
          {
            type: 'tool',
            toolCallId: 't1',
            toolName: 'list_issues',
            args: '{"status":"open"}',
            result: '2 issues',
          },
          { type: 'text', text: 'are left.' },
        ],
      },
    ]);
  });

  it('streams the answer and always ends on a terminal event', async () => {
    const { owner, asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Ping');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Pong' }],
    });
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({ status: 'success' });

    const stream = await readStream(owner.cookie, agent.id, answer.id);
    expect(stream.status).toBe(200);
    // Every frame carries the event's id, which is the cursor a reconnect resumes from.
    expect(stream.frames[0]).toStartWith('id: ');
    expect(stream.frames[0]).toContain('Pong');
    // The runner reported no lifecycle events, so the end is stated for it.
    expect(stream.frames.at(-1)).toContain('RUN_FINISHED');
  });

  it('ends a failed answer with the reason it stopped', async () => {
    const { owner, asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Ping');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).result.post({
      status: 'failed',
      error: 'claude exited with 1',
    });

    const stream = await readStream(owner.cookie, agent.id, answer.id);
    expect(stream.frames.at(-1)).toContain('RUN_ERROR');
    expect(stream.frames.at(-1)).toContain('claude exited with 1');
  });

  it('keeps a claimed answer leased through a heartbeat', async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Hello');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;

    const beat = await asRunner['agent-chats']({ messageId: answer.id }).heartbeat.post();
    expect(beat.status).toBe(200);
    expect(beat.data).toEqual({ canceled: false });
  });

  // The server has no connection to the operator's machine: the stop is returned on the
  // calls the runner already makes.
  it('tells the runner on its next report that the answer was stopped', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Summarise the sprint');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Two things ' }],
    });

    const stopped = await chatOf(asOwner, agent.id).chat({ messageId: answer.id }).cancel.post();
    expect(stopped.status).toBe(204);

    const reported = await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'are left.' }],
    });
    expect(reported.data).toEqual({ canceled: true });
    // A runner writing nothing learns of it on the heartbeat instead.
    expect((await asRunner['agent-chats']({ messageId: answer.id }).heartbeat.post()).data).toEqual(
      { canceled: true },
    );

    // What arrived before the stop stays; what was reported after it did not.
    const transcript = await chatOf(asOwner, agent.id)
      .threads({ threadId: sent.data!.threadId })
      .messages.get();
    expect(transcript.data!.items).toMatchObject([
      { role: 'user' },
      { role: 'assistant', parts: [{ type: 'text', text: 'Two things ' }], stopped: true },
    ]);
  });

  it('does not hand a stopped answer out again', async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Ping');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await chatOf(asOwner, agent.id).chat({ messageId: answer.id }).cancel.post();

    expect((await asRunner['agent-chats'].claim.post()).data!.message).toBeNull();
  });

  // The stop was asked for, so the stream ends the way a finished answer does rather
  // than reporting an error to the member who pressed it.
  it('ends a stopped answer without an error', async () => {
    const { owner, asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Ping');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: answer.id }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Po' }],
    });
    await chatOf(asOwner, agent.id).chat({ messageId: answer.id }).cancel.post();

    const stream = await readStream(owner.cookie, agent.id, answer.id);
    expect(stream.frames[0]).toContain('Po');
    expect(stream.frames.at(-1)).toContain('RUN_FINISHED');
  });

  it("refuses to stop another member's answer", async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Private question');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    const asMember = await addProjectMember(asOwner, 'MKT');

    expect(
      (await chatOf(asMember, agent.id).chat({ messageId: answer.id }).cancel.post()).status,
    ).toBe(404);
  });

  it('records the failure the runner reports and stops taking events', async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'Hello');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;

    await asRunner['agent-chats']({ messageId: answer.id }).result.post({
      status: 'failed',
      error: 'claude exited with 1',
    });

    const events = await chatOf(asOwner, agent.id).chat({ messageId: answer.id }).events.get();
    expect(events.data!).toMatchObject({ status: 'failed', error: 'claude exited with 1' });
    expect(
      (
        await asRunner['agent-chats']({ messageId: answer.id }).events.post({
          events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'late' }],
        })
      ).status,
    ).toBe(404);
    expect(
      (await asRunner['agent-chats']({ messageId: answer.id }).result.post({ status: 'success' }))
        .status,
    ).toBe(404);
  });

  it("renames an external agent's conversation", async () => {
    const { asOwner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'First question');

    expect(
      (
        await chatOf(asOwner, agent.id)
          .threads({ threadId: sent.data!.threadId })
          .patch({ title: 'Release plan' })
      ).status,
    ).toBe(204);
    expect((await chatOf(asOwner, agent.id).threads.get()).data!.items[0].title).toBe(
      'Release plan',
    );
  });

  it('lists and deletes the conversations of an external agent', async () => {
    const { asOwner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'First question');

    const threads = await chatOf(asOwner, agent.id).threads.get();
    expect(threads.data!.items).toMatchObject([
      { id: sent.data!.threadId, title: 'First question' },
    ]);

    expect(
      (await chatOf(asOwner, agent.id).threads({ threadId: sent.data!.threadId }).delete()).status,
    ).toBe(204);
    expect((await chatOf(asOwner, agent.id).threads.get()).data!.items).toEqual([]);
  });

  it('finds a conversation by its title and by the text of both roles', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const byTitle = await send(asOwner, agent.id, 'the launch plan');
    await answer(asRunner, 'noted');
    // Asked in the second turn, so the title of that conversation does not match too.
    const byQuestion = await send(asOwner, agent.id, 'status update');
    await answer(asRunner, 'all green');
    await send(asOwner, agent.id, 'when is the launch?', byQuestion.data!.threadId);
    await answer(asRunner, 'in May');
    const byAnswer = await send(asOwner, agent.id, 'what is next?');
    await answer(asRunner, 'the launch, then the retro');
    await send(asOwner, agent.id, 'invoices');
    await answer(asRunner, 'paid');

    const res = await chatOf(asOwner, agent.id).threads.get({ query: { q: 'launch' } });
    expect(res.status).toBe(200);
    // Ranked: the title first, then the member's own message, then the agent's reply.
    expect(res.data!.items.map((t) => t.id)).toEqual([
      byTitle.data!.threadId,
      byQuestion.data!.threadId,
      byAnswer.data!.threadId,
    ]);
    expect(res.data!.items.map((t) => t.match)).toEqual(['title', 'user', 'assistant']);
    expect(res.data!.items[2].snippet).toContain('the launch, then the retro');
  });

  it("does not match a tool call's arguments or result", async () => {
    const { asOwner, asRunner, agent } = await setup();
    await send(asOwner, agent.id, 'what is left?');
    const claimed = (await asRunner['agent-chats'].claim.post()).data!.message!;
    await asRunner['agent-chats']({ messageId: claimed.id }).events.post({
      events: [
        { type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 'list_issues' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: '{"status":"kryptonite"}' },
        { type: 'TOOL_CALL_RESULT', messageId: 'm1', toolCallId: 'call-1', content: 'kryptonite' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Two things.' },
      ],
    });
    await asRunner['agent-chats']({ messageId: claimed.id }).result.post({ status: 'success' });

    const res = await chatOf(asOwner, agent.id).threads.get({ query: { q: 'kryptonite' } });
    expect(res.data!.items).toEqual([]);
  });

  it('stars a conversation, lists it as its own group, and drops the star with it', async () => {
    const { asOwner, agent } = await setup();
    const kept = await send(asOwner, agent.id, 'kept');
    const plain = await send(asOwner, agent.id, 'plain');
    const thread = chatOf(asOwner, agent.id).threads({ threadId: kept.data!.threadId });

    expect((await thread.favorite.put()).status).toBe(204);

    const favorites = await chatOf(asOwner, agent.id).threads.get({ query: { favorites: true } });
    expect(favorites.data!.items.map((t) => t.id)).toEqual([kept.data!.threadId]);
    expect(favorites.data!.nextPage).toBeNull();

    // The group holds it, so the list below no longer shows it a second time.
    const rest = await chatOf(asOwner, agent.id).threads.get();
    expect(rest.data!.items.map((t) => t.id)).toEqual([plain.data!.threadId]);

    expect((await thread.favorite.delete()).status).toBe(204);
    expect(
      (await chatOf(asOwner, agent.id).threads.get({ query: { favorites: true } })).data!.items,
    ).toEqual([]);
    const back = await chatOf(asOwner, agent.id).threads.get();
    expect(back.data!.items.map((t) => t.id)).toEqual([plain.data!.threadId, kept.data!.threadId]);
  });

  it("404s starring another member's conversation", async () => {
    const { asOwner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Private question');
    const asMember = await addProjectMember(asOwner, 'MKT');

    expect(
      (await chatOf(asMember, agent.id).threads({ threadId: sent.data!.threadId }).favorite.put())
        .status,
    ).toBe(404);
  });

  it("refuses another member's thread and another agent's answer", async () => {
    const { asOwner, asRunner, agent } = await setup();
    const sent = await send(asOwner, agent.id, 'Private question');
    const answer = (await asRunner['agent-chats'].claim.post()).data!.message!;
    const asMember = await addProjectMember(asOwner, 'MKT');

    expect((await send(asMember, agent.id, 'Sneak in', sent.data!.threadId)).status).toBe(404);
    expect(
      (await chatOf(asMember, agent.id).chat({ messageId: answer.id }).events.get()).status,
    ).toBe(404);

    const other = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents'].post({ name: 'Other Bot', username: 'other', kind: 'external' });
    const asOtherRunner = apiKeyApi(other.data!.apiKey!);
    expect(
      (
        await asOtherRunner['agent-chats']({ messageId: answer.id }).result.post({
          status: 'success',
        })
      ).status,
    ).toBe(404);
  });

  it('takes chat messages only for an external agent, and only from its own key', async () => {
    const { asOwner, agent } = await setup();
    const internal = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents'].post({ name: 'In Bot', username: 'in', kind: 'internal' });

    // An internal agent is chatted with through /run and /run/stream instead.
    expect((await send(asOwner, internal.data!.agent.id, 'Hello')).status).toBe(400);
    // And a member's session is not a runner.
    expect((await asOwner['agent-chats'].claim.post()).status).toBe(403);
    expect((await send(asOwner, agent.id, 'Hello')).status).toBe(200);
  });

  it("keeps an owner-scoped agent's chat to its owner", async () => {
    const { asOwner, agent } = await setup();
    await chatOf(asOwner, agent.id).patch({ runnerScope: 'owner' });
    const asMember = await addProjectMember(asOwner, 'MKT');

    expect((await send(asMember, agent.id, 'Hello')).status).toBe(403);
    expect((await send(asOwner, agent.id, 'Hello')).status).toBe(200);
  });
});
