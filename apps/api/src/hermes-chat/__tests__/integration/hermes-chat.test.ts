import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../../../app';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

let mockServer: ReturnType<typeof Bun.serve>;
let sessionSequence = 0;
let streamRequests = 0;
const requests: Array<{ path: string; authorization: string | null; body: unknown }> = [];

beforeAll(() => {
  mockServer = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const body = request.method === 'POST' ? await request.json().catch(() => null) : null;
      requests.push({
        path: url.pathname,
        authorization: request.headers.get('authorization'),
        body,
      });
      if (request.headers.get('authorization') !== 'Bearer bob-test-key') {
        return Response.json(
          { error: { message: 'wrong upstream key api-secret' } },
          { status: 401 },
        );
      }
      if (url.pathname === '/p/default/v1/capabilities') {
        return Response.json({
          features: { session_resources: true, session_chat_streaming: true },
          endpoints: {
            session_create: { method: 'POST', path: '/api/sessions' },
            session_chat_stream: {
              method: 'POST',
              path: '/api/sessions/{session_id}/chat/stream',
            },
          },
        });
      }
      if (url.pathname === '/p/default/api/sessions' && request.method === 'POST') {
        sessionSequence += 1;
        return Response.json(
          { object: 'hermes.session', session: { id: `session_${sessionSequence}` } },
          { status: 201 },
        );
      }
      if (/^\/p\/default\/api\/sessions\/session_\d+\/chat\/stream$/.test(url.pathname)) {
        streamRequests += 1;
        if ((body as { input?: string } | null)?.input === 'Disconnect') {
          return new Response('event: assistant.delta\ndata: {"delta":"Partial"}\n\n', {
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }
        const stream = [
          'event: run.started\ndata: {"run_id":"upstream-run"}\n\n',
          'event: assistant.delta\ndata: {"delta":"Hello "}\n\n',
          'event: tool.started\ndata: {"tool_name":"web_search","args":{"apiKey":"secret"}}\n\n',
          'event: tool.completed\ndata: {"tool_name":"web_search","preview":"private"}\n\n',
          'event: assistant.delta\ndata: {"delta":"from Bob"}\n\n',
          'event: assistant.completed\ndata: {"message_id":"message-1","content":"Hello from Bob"}\n\n',
          'event: run.completed\ndata: {"usage":{"input_tokens":2,"output_tokens":3}}\n\n',
          'event: done\ndata: {}\n\n',
        ].join('');
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }
      return Response.json({ error: 'not found' }, { status: 404 });
    },
  });
  process.env.HERMES_API_BASE_URL = `http://127.0.0.1:${mockServer.port}`;
  process.env.HERMES_BOB_API_KEY = 'bob-test-key';
  process.env.HERMES_BOB_PROJECT_KEY = 'MKT';
});

afterAll(() => {
  mockServer.stop(true);
  delete process.env.HERMES_API_BASE_URL;
  delete process.env.HERMES_BOB_API_KEY;
  delete process.env.HERMES_BOB_PROJECT_KEY;
});

beforeEach(async () => {
  await resetDb();
  requests.length = 0;
  sessionSequence = 0;
  streamRequests = 0;
  process.env.HERMES_BOB_API_KEY = 'bob-test-key';
});

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const created = await asOwner.projects({ projectKey: 'MKT' })['ai-agents'].post({
    name: 'Bob',
    username: 'bob-agent',
    kind: 'external',
  });
  return { owner, asOwner, agentId: created.data!.agent.id };
}

const hermesConversations = (api: Api) =>
  api.projects({ projectKey: 'MKT' })['hermes-conversations'];

async function stream(
  cookie: string,
  conversationId: string,
  message: string,
  idempotencyKey: string,
) {
  return app.handle(
    new Request(
      `http://localhost/projects/MKT/hermes-conversations/${conversationId}/messages/stream`,
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ message, idempotencyKey }),
      },
    ),
  );
}

describe('Hermes dashboard chat', () => {
  it('lists only the approved Bob agent with bounded readiness', async () => {
    const { asOwner } = await setup();
    await asOwner.projects({ projectKey: 'MKT' })['ai-agents'].post({
      name: 'Unknown',
      username: 'unknown',
      kind: 'external',
    });

    const response = await asOwner.projects({ projectKey: 'MKT' })['hermes-agents'].get();

    expect(response.status).toBe(200);
    expect(response.data).toEqual([
      expect.objectContaining({ slug: 'bob', displayName: 'Bob', status: 'ready' }),
    ]);
    expect(requests.at(-1)).toMatchObject({
      path: '/p/default/v1/capabilities',
      authorization: 'Bearer bob-test-key',
    });
  });

  it('creates separate Hermes sessions for two Bob conversations', async () => {
    const { asOwner, agentId } = await setup();

    const first = await hermesConversations(asOwner).post({ agentId, title: 'Sales' });
    const second = await hermesConversations(asOwner).post({ agentId, title: 'Technical' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.data?.id).not.toBe(second.data?.id);
    expect(requests.filter((request) => request.path === '/p/default/api/sessions')).toHaveLength(
      2,
    );
    const listed = await hermesConversations(asOwner).get();
    expect(listed.data?.map((conversation) => conversation.title).sort()).toEqual([
      'Sales',
      'Technical',
    ]);
  });

  it('ignores browser-supplied routing fields and streams sanitized events', async () => {
    const { owner, asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({
      agentId,
      title: 'Secure',
      profile: 'vexol-lead-sourcing',
      url: 'https://attacker.invalid',
      apiKey: 'browser-secret',
    } as never);

    const response = await stream(
      owner.cookie,
      conversation.data!.id,
      'Hello',
      crypto.randomUUID(),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('Hello ');
    expect(text).toContain('from Bob');
    expect(text).toContain('tool-start');
    expect(text).not.toContain('apiKey');
    expect(text).not.toContain('private');
    expect(requests.at(-1)?.path).toBe('/p/default/api/sessions/session_1/chat/stream');

    const messages = await hermesConversations(asOwner)({
      conversationId: conversation.data!.id,
    }).messages.get();
    expect(messages.data?.map((message) => ({ role: message.role, text: message.text }))).toEqual([
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hello from Bob' },
    ]);
  });

  it('rejects cross-user and modified conversation IDs without contacting Hermes', async () => {
    const { asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({ agentId });
    const member = await signUpTestUser({ name: 'Member' });
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: member.email, role: 'member' });
    const asMember = authedApi(member.cookie);
    await asMember.invites({ token: invite.data!.token }).accept.post();
    const before = requests.length;

    const otherUser = await stream(
      member.cookie,
      conversation.data!.id,
      'Read this',
      crypto.randomUUID(),
    );
    const modified = await stream(
      member.cookie,
      crypto.randomUUID(),
      'Read this',
      crypto.randomUUID(),
    );

    expect(otherUser.status).toBe(404);
    expect(modified.status).toBe(404);
    expect(requests).toHaveLength(before);
  });

  it('submits an idempotency key only once and keeps the agent binding immutable', async () => {
    const { owner, asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({ agentId });
    const key = crypto.randomUUID();

    const first = await stream(owner.cookie, conversation.data!.id, 'Once', key);
    await first.text();
    const duplicate = await stream(owner.cookie, conversation.data!.id, 'Twice', key);

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(409);
    expect(streamRequests).toBe(1);
  });

  it('keeps an existing conversation on Bob after the agent username changes', async () => {
    const { owner, asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({ agentId });
    await asOwner.projects({ projectKey: 'MKT' })['ai-agents']({ agentId }).patch({
      username: 'renamed-agent',
    });

    const response = await stream(
      owner.cookie,
      conversation.data!.id,
      'Still Bob',
      crypto.randomUUID(),
    );
    await response.text();
    const newConversation = await hermesConversations(asOwner).post({ agentId });
    const conversations = await hermesConversations(asOwner).get({ query: { agentId } });

    expect(response.status).toBe(200);
    expect(requests.some((request) => request.path.includes('/p/default/'))).toBe(true);
    expect(newConversation.status).toBe(404);
    expect(conversations.data?.[0]?.agentSlug).toBe('bob');
  });

  it('rejects a whitespace-only message before contacting Hermes', async () => {
    const { owner, asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({ agentId });
    const before = requests.length;

    const response = await stream(owner.cookie, conversation.data!.id, '   ', crypto.randomUUID());

    expect(response.status).toBe(400);
    expect(requests).toHaveLength(before);
  });

  it('preserves conversation history by blocking deletion of its agent', async () => {
    const { asOwner, agentId } = await setup();
    await hermesConversations(asOwner).post({ agentId });

    const deleted = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({
        agentId,
      })
      .delete();
    const conversations = await hermesConversations(asOwner).get({ query: { agentId } });

    expect(deleted.status).toBe(409);
    expect(conversations.data).toHaveLength(1);
  });

  it('returns a controlled error for the wrong profile key without leaking upstream details', async () => {
    const { asOwner, agentId } = await setup();
    process.env.HERMES_BOB_API_KEY = 'wrong-key';

    const response = await hermesConversations(asOwner).post({ agentId });

    expect(response.status).toBe(502);
    expect(response.error?.value).toEqual({ error: 'Bob could not create a conversation' });
    expect(JSON.stringify(response.error?.value)).not.toContain('api-secret');
  });

  it('maps an upstream disconnect to a recoverable failed state', async () => {
    const { owner, asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({ agentId });

    const response = await stream(
      owner.cookie,
      conversation.data!.id,
      'Disconnect',
      crypto.randomUUID(),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('Bob disconnected. You can send the message again.');
    expect(text).not.toContain('upstream_disconnect');
    const messages = await hermesConversations(asOwner)({
      conversationId: conversation.data!.id,
    }).messages.get();
    expect(messages.data?.at(-1)).toMatchObject({ role: 'assistant', status: 'failed' });
  });

  it('archives locally and rejects new messages without deleting Hermes history', async () => {
    const { owner, asOwner, agentId } = await setup();
    const conversation = await hermesConversations(asOwner).post({ agentId });
    const before = requests.length;

    const archived = await hermesConversations(asOwner)({
      conversationId: conversation.data!.id,
    }).delete();
    const response = await stream(
      owner.cookie,
      conversation.data!.id,
      'After archive',
      crypto.randomUUID(),
    );

    expect(archived.status).toBe(204);
    expect(response.status).toBe(409);
    expect(requests).toHaveLength(before);
    expect(
      requests.some(
        (request) =>
          request.path.includes('/api/sessions/session_1') && request.path.endsWith('/delete'),
      ),
    ).toBe(false);
  });
});
