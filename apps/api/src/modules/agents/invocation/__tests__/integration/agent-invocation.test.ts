import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createHmac } from 'node:crypto';
import { apiKeyApi, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createAgent, teamOf } from '#tests/helpers/agents';
import { dispatchInvocations } from '#modules/agents/invocation/service';

// An external agent with an invocation URL is sent its runs and chat messages instead of
// a runner claiming them. The endpoint is a server on localhost, which the SSRF guard
// refuses under NODE_ENV=test, so each case runs as development, the way the git
// provider tests reach theirs.

interface Received {
  event: string;
  signature: string;
  body: string;
  json: {
    event: string;
    agent: { id: number; username: string };
    run?: { id: number; prompt: string };
    message?: { id: number; prompt: string };
  };
}

function fakeEndpoint(respond: () => Response | Promise<Response> = () => new Response('ok')) {
  const received: Received[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const body = await req.text();
      received.push({
        event: req.headers.get('x-itsaplan-event') ?? '',
        signature: req.headers.get('x-itsaplan-signature') ?? '',
        body,
        json: JSON.parse(body),
      });
      return respond();
    },
  });
  return { url: `http://127.0.0.1:${server.port}/agent`, received, stop: () => server.stop(true) };
}

// What a receiver does with the header: recompute the HMAC over the bytes it got.
function signedWith(secret: string, item: Received): boolean {
  const [t, v1] = item.signature.split(',').map((part) => part.split('=')[1]);
  return createHmac('sha256', secret).update(`${t}.${item.body}`).digest('hex') === v1;
}

async function setup(invocationUrl?: string) {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const created = await createAgent(asOwner, 'MKT', {
    name: 'Cloud Bot',
    username: 'cloud',
    kind: 'external',
    triggerOnMention: true,
    invocationUrl,
  });
  return {
    asOwner,
    teamId: await teamOf(asOwner, 'MKT'),
    columnId: view.data!.columns[0].id,
    agent: created.data!.agent,
    asAgent: apiKeyApi(created.data!.apiKey!),
  };
}

function agentOf(api: Api, teamId: number, agentId: number) {
  return api.teams({ teamId })['ai-agents']({ agentId });
}

function chatOf(api: Api, agentId: number) {
  return api.projects({ projectKey: 'MKT' })['ai-agents']({ agentId });
}

async function queueRun(asOwner: Api, columnId: number) {
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Landing page' })
  ).data!;
  await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'please review @cloud' });
  return issue;
}

async function lastRun(asOwner: Api, teamId: number, agentId: number) {
  return (await agentOf(asOwner, teamId, agentId).runs.get({ query: {} })).data!.items[0];
}

const ENV_KEYS = ['NODE_ENV', 'AGENT_RUN_MAX_ATTEMPTS', 'AGENT_INVOCATION_TIMEOUT_MS'] as const;

describe('agent invocation', () => {
  const environment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  let endpoint: ReturnType<typeof fakeEndpoint> | null = null;

  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
  });

  afterEach(async () => {
    await endpoint?.stop();
    endpoint = null;
    for (const key of ENV_KEYS) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  });

  it('issues a signing secret with the first URL and keeps it when the URL changes', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, teamId, agent } = await setup(endpoint.url);
    expect(agent.invocationUrl).toBe(endpoint.url);

    const first = await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get();
    expect(first.status).toBe(200);
    expect(first.data!.secret).toStartWith('whsec_');

    const moved = `${endpoint.url}/v2`;
    const patched = await agentOf(asOwner, teamId, agent.id).patch({ invocationUrl: moved });
    expect(patched.data!.invocationUrl).toBe(moved);
    const second = await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get();
    expect(second.data!.secret).toBe(first.data!.secret);
  });

  it('rotates the secret', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, teamId, agent } = await setup(endpoint.url);
    const before = (await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get()).data!;

    const rotated = await agentOf(asOwner, teamId, agent.id)['invocation-secret'].post();
    expect(rotated.status).toBe(200);
    expect(rotated.data!.secret).not.toBe(before.secret!);
    const after = (await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get()).data!;
    expect(after.secret).toBe(rotated.data!.secret);
  });

  it('has no URL and no secret for an agent a runner drains', async () => {
    const { asOwner, teamId, agent } = await setup();
    expect(agent.invocationUrl).toBeNull();
    const res = await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get();
    expect(res.data!.secret).toBeNull();
  });

  it('refuses a URL that points to a private address', async () => {
    const { asOwner, teamId, agent } = await setup();
    process.env.NODE_ENV = 'test';
    for (const invocationUrl of ['http://127.0.0.1:9/agent', 'https://10.0.0.1/agent']) {
      const res = await agentOf(asOwner, teamId, agent.id).patch({ invocationUrl });
      expect(res.status).toBe(400);
    }
  });

  it('ignores a URL on an internal agent and refuses its invocation routes', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Inside',
      username: 'inside',
      kind: 'internal',
      invocationUrl: 'https://agents.example.com/run',
    });
    expect(created.data!.agent.invocationUrl).toBeNull();
    const res = await agentOf(asOwner, teamId, created.data!.agent.id)['invocation-secret'].get();
    expect(res.status).toBe(400);
  });

  it('keeps the secret and the test to members who may edit agents', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, teamId, agent } = await setup(endpoint.url);
    const asMember = await addProjectMember(asOwner, 'MKT');

    expect((await agentOf(asMember, teamId, agent.id).get()).data!.invocationUrl).toBe(
      endpoint.url,
    );
    expect((await agentOf(asMember, teamId, agent.id)['invocation-secret'].get()).status).toBe(403);
    expect((await agentOf(asMember, teamId, agent.id)['invocation-secret'].post()).status).toBe(
      403,
    );
    expect((await agentOf(asMember, teamId, agent.id)['invocation-test'].post()).status).toBe(403);
  });

  it('sends a test ping the endpoint can verify', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, teamId, agent } = await setup(endpoint.url);
    const { secret } = (await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get()).data!;

    const res = await agentOf(asOwner, teamId, agent.id)['invocation-test'].post();
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ ok: true, status: 200, responseBody: 'ok', error: null });
    expect(endpoint.received).toHaveLength(1);
    expect(endpoint.received[0]).toMatchObject({
      event: 'ping',
      json: { event: 'ping', agent: { id: agent.id, username: 'cloud' } },
    });
    expect(signedWith(secret!, endpoint.received[0])).toBe(true);
  });

  it('reports how an endpoint refused the ping', async () => {
    endpoint = fakeEndpoint(() => new Response('bad signature', { status: 401 }));
    const { asOwner, teamId, agent } = await setup(endpoint.url);

    const res = await agentOf(asOwner, teamId, agent.id)['invocation-test'].post();
    expect(res.data).toMatchObject({
      ok: false,
      timedOut: false,
      status: 401,
      responseBody: 'bad signature',
      error: 'The endpoint answered 401',
    });
  });

  it('refuses a test for an agent with no URL', async () => {
    const { asOwner, teamId, agent } = await setup();
    expect((await agentOf(asOwner, teamId, agent.id)['invocation-test'].post()).status).toBe(400);
  });

  it('sends a queued run, which the endpoint finishes with the agent key', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, asAgent, teamId, columnId, agent } = await setup(endpoint.url);
    const { secret } = (await agentOf(asOwner, teamId, agent.id)['invocation-secret'].get()).data!;
    const issue = await queueRun(asOwner, columnId);

    await dispatchInvocations();
    expect(endpoint.received).toHaveLength(1);
    const sent = endpoint.received[0];
    expect(sent.event).toBe('agent.run');
    expect(sent.json.run).toMatchObject({ trigger: 'mention', issueId: issue.id, attempts: 1 });
    expect(sent.json.run!.prompt).toContain('please review');
    expect(signedWith(secret!, sent)).toBe(true);

    // Leased: the next pass sends nothing while the endpoint works on it.
    await dispatchInvocations();
    expect(endpoint.received).toHaveLength(1);

    const done = await asAgent['agent-runs']({ runId: sent.json.run!.id }).result.post({
      status: 'success',
      output: 'Opened PR #12',
    });
    expect(done.status).toBe(204);
    expect(await lastRun(asOwner, teamId, agent.id)).toMatchObject({
      status: 'success',
      output: 'Opened PR #12',
    });
  });

  it('puts a run the endpoint refused back for a retry', async () => {
    endpoint = fakeEndpoint(() => new Response('down', { status: 500 }));
    const { asOwner, teamId, columnId, agent } = await setup(endpoint.url);
    await queueRun(asOwner, columnId);

    await dispatchInvocations();
    expect(await lastRun(asOwner, teamId, agent.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'The endpoint answered 500',
    });
  });

  it('fails a run the endpoint refused on its last attempt', async () => {
    process.env.AGENT_RUN_MAX_ATTEMPTS = '1';
    endpoint = fakeEndpoint(() => new Response('down', { status: 500 }));
    const { asOwner, teamId, columnId, agent } = await setup(endpoint.url);
    const issue = await queueRun(asOwner, columnId);

    await dispatchInvocations();
    expect(await lastRun(asOwner, teamId, agent.id)).toMatchObject({
      status: 'failed',
      lastError: 'The endpoint answered 500',
    });
    const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
    expect(feed.data!.items).toContainEqual(
      expect.objectContaining({
        action: 'agent_finished',
        payload: { subject: { value: 'failed' } },
      }),
    );
  });

  it('leaves a run under its lease when the endpoint does not answer in time', async () => {
    process.env.AGENT_INVOCATION_TIMEOUT_MS = '100';
    endpoint = fakeEndpoint(() => new Promise<Response>(() => {}));
    const { asOwner, teamId, columnId, agent } = await setup(endpoint.url);
    await queueRun(asOwner, columnId);

    await dispatchInvocations();
    await dispatchInvocations();
    expect(endpoint.received).toHaveLength(1);
    expect(await lastRun(asOwner, teamId, agent.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: null,
    });
  });

  it('sends a chat message, and the endpoint reports the answer back', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, asAgent, agent } = await setup(endpoint.url);
    const { messageId } = (await chatOf(asOwner, agent.id).chat.post({ prompt: 'Status?' })).data!;

    await dispatchInvocations();
    const sent = endpoint.received[0];
    expect(sent.event).toBe('agent.chat');
    expect(sent.json.message).toMatchObject({ id: messageId, attempts: 1 });
    expect(sent.json.message!.prompt).toContain('Status?');

    await asAgent['agent-chats']({ messageId }).events.post({
      events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'All green.' }],
    });
    await asAgent['agent-chats']({ messageId }).result.post({ status: 'success' });
    const events = await chatOf(asOwner, agent.id).chat({ messageId }).events.get({ query: {} });
    expect(events.data!.status).toBe('success');
    expect(events.data!.items.map((item) => item.event)).toContainEqual(
      expect.objectContaining({ delta: 'All green.' }),
    );
  });

  it('fails a chat answer the endpoint refused', async () => {
    endpoint = fakeEndpoint(() => new Response('busy', { status: 503 }));
    const { asOwner, agent } = await setup(endpoint.url);
    const { messageId } = (await chatOf(asOwner, agent.id).chat.post({ prompt: 'Status?' })).data!;

    await dispatchInvocations();
    const events = await chatOf(asOwner, agent.id).chat({ messageId }).events.get({ query: {} });
    expect(events.data).toMatchObject({ status: 'failed', error: 'The endpoint answered 503' });
  });

  it('refuses a runner claim while the agent has a URL', async () => {
    endpoint = fakeEndpoint();
    const { asOwner, asAgent, teamId, agent } = await setup(endpoint.url);
    expect((await asAgent['agent-runs'].claim.post()).status).toBe(409);
    expect((await asAgent['agent-chats'].claim.post()).status).toBe(409);

    await agentOf(asOwner, teamId, agent.id).patch({ invocationUrl: null });
    expect((await asAgent['agent-runs'].claim.post()).status).toBe(200);
  });
});
