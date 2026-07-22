import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// AI agents attached to a project. Each agent is backed by a hidden bot user, owns a
// better-auth API key, and is a project member acting under a project role. An
// external agent needs only a name + username, and its operator gets the key secret
// (returned once on create and again on regenerate); an internal agent adds a model
// configuration and its key stays server-side for its own runtime. Agents show up as
// assignee candidates on the project aggregate. Access is the ai_agents permission
// resource.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner };
}

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

describe('ai agents', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates an external agent and returns its key once', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Webhook Bot',
      username: 'webhook',
      kind: 'external',
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({
      name: 'Webhook Bot',
      username: 'webhook',
      kind: 'external',
    });
    expect(typeof res.data?.apiKey).toBe('string');
    expect(res.data?.apiKey?.length ?? 0).toBeGreaterThan(10);
    // The key start is kept for display; the secret itself is not on the row.
    expect(res.data?.agent.apiKeyStart).toBeTruthy();
  });

  it('lists the tool catalog: grantable actions plus always-on read tools', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).tools.get();
    expect(res.status).toBe(200);
    expect(res.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'create_issue', label: expect.any(String), always: false }),
        expect.objectContaining({
          key: 'create_initiative',
          label: expect.any(String),
          always: false,
        }),
        expect.objectContaining({
          key: 'get_project',
          label: expect.any(String),
          always: true,
        }),
        expect.objectContaining({ key: 'search_issues', label: expect.any(String), always: true }),
        expect.objectContaining({ key: 'list_issues', label: expect.any(String), always: true }),
        expect.objectContaining({
          key: 'list_initiatives',
          label: expect.any(String),
          always: true,
        }),
      ]),
    );
  });

  it('stores no model config on an external agent even when config fields are sent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Ext',
      username: 'ext',
      kind: 'external',
      model: 'gpt-5.4',
      tools: ['create_issue'],
      memoryEnabled: true,
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({
      kind: 'external',
      modelCredentialId: null,
      model: null,
      tools: [],
      memoryEnabled: false,
    });
  });

  it('creates an internal agent and keeps only registered tools', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Triage Bot',
      username: 'triage',
      kind: 'internal',
      model: 'gpt-5.4',
      instructions: 'Triage incoming issues.',
      tools: ['create_issue', 'not_a_real_tool'],
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({ kind: 'internal', model: 'gpt-5.4' });
    expect(res.data?.agent.tools).toEqual(['create_issue']);
    // An internal agent owns a key too — its runtime replays it against the routes —
    // but nobody outside has to hold it, so the secret is never returned.
    expect(res.data?.apiKey).toBeNull();
    expect(res.data?.agent.apiKeyStart).toBeTruthy();
  });

  it('stores conversation memory config on an internal agent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Memo Bot',
      username: 'memo',
      kind: 'internal',
      memoryEnabled: true,
      memoryLastMessages: 15,
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({ memoryEnabled: true, memoryLastMessages: 15 });
    const upd = await agents(asOwner)({ agentId: res.data!.agent.id }).patch({
      memoryEnabled: false,
    });
    expect(upd.data).toMatchObject({ memoryEnabled: false, memoryLastMessages: 15 });
  });

  it("defaults an internal agent's triggers and stores overrides", async () => {
    const { asOwner } = await setup();
    const def = await agents(asOwner).post({ name: 'T1', username: 't1', kind: 'internal' });
    expect(def.data?.agent).toMatchObject({ triggerOnMention: true, triggerOnAssign: false });

    const custom = await agents(asOwner).post({
      name: 'T2',
      username: 't2',
      kind: 'internal',
      triggerOnMention: false,
      triggerOnAssign: true,
    });
    expect(custom.data?.agent).toMatchObject({ triggerOnMention: false, triggerOnAssign: true });

    const upd = await agents(asOwner)({ agentId: custom.data!.agent.id }).patch({
      triggerOnMention: true,
    });
    expect(upd.data).toMatchObject({ triggerOnMention: true, triggerOnAssign: true });
  });

  it('assigns an authorization role to either kind of agent', async () => {
    const { asOwner } = await setup();
    // The project ships with a default "Member" role; use its id.
    const roles = await asOwner.projects({ projectKey: 'MKT' }).roles.get();
    const roleId = roles.data![0].id;
    const res = await agents(asOwner).post({
      name: 'Ext',
      username: 'ext',
      kind: 'external',
      roleId,
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({ kind: 'external', roleId });
    // Both kinds act through the same API under a role, so an internal agent takes
    // one too: its tool calls are checked by the same permission matrix.
    const internal = await agents(asOwner).post({
      name: 'Int',
      username: 'int',
      kind: 'internal',
      roleId,
    });
    expect(internal.data?.agent).toMatchObject({ kind: 'internal', roleId });
  });

  it('lists agents without the secret', async () => {
    const { asOwner } = await setup();
    await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const res = await agents(asOwner).get();
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]).not.toHaveProperty('apiKey');
    expect(res.data?.[0].apiKeyStart).toBeTruthy();
  });

  it('gets one agent by id, without the secret', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const agentId = created.data!.agent.id;

    const res = await agents(asOwner)({ agentId }).get();
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: agentId, name: 'Bot', username: 'bot' });
    expect(res.data).not.toHaveProperty('apiKey');
  });

  it('returns 404 for a missing agent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 }).get();
    expect(res.status).toBe(404);
  });

  it('exposes the created agent as an assignee candidate', async () => {
    const { asOwner } = await setup();
    await agents(asOwner).post({ name: 'Assign Me', username: 'assignme', kind: 'external' });
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    const agent = project.data?.assignees.find((a) => a.kind === 'agent');
    expect(agent).toMatchObject({ name: 'Assign Me', kind: 'agent', agentKind: 'external' });
  });

  it('regenerates the key with a new secret', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const agentId = created.data!.agent.id;
    const res = await agents(asOwner)({ agentId })['regenerate-key'].post();
    expect(res.status).toBe(200);
    expect(res.data?.apiKey).toBeTruthy();
    expect(res.data?.apiKey).not.toBe(created.data?.apiKey);
  });

  it('rejects regenerating the key on an internal agent with 400', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' });
    const res = await agents(asOwner)({ agentId: created.data!.agent.id })['regenerate-key'].post();
    expect(res.status).toBe(400);
  });

  it('updates name, config, and tools', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' });
    const agentId = created.data!.agent.id;
    const res = await agents(asOwner)({ agentId }).patch({
      name: 'Renamed',
      model: 'gpt-5.4-mini',
      tools: ['add_comment'],
    });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      name: 'Renamed',
      model: 'gpt-5.4-mini',
      tools: ['add_comment'],
    });
  });

  it('deletes an agent and drops it from assignee candidates', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const agentId = created.data!.agent.id;
    const del = await agents(asOwner)({ agentId }).delete();
    expect(del.status).toBe(204);
    const list = await agents(asOwner).get();
    expect(list.data).toHaveLength(0);
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    expect(project.data?.assignees.some((a) => a.kind === 'agent')).toBe(false);
  });

  it('rejects a duplicate username with 409', async () => {
    const { asOwner } = await setup();
    await agents(asOwner).post({ name: 'First', username: 'dup', kind: 'external' });
    const res = await agents(asOwner).post({ name: 'Second', username: 'dup', kind: 'external' });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid username with 400', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Bad',
      username: 'has spaces',
      kind: 'external',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an empty name with 400', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({ name: '', username: 'bot', kind: 'external' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown kind with 400', async () => {
    const { asOwner } = await setup();
    // kind must be "external" | "internal".
    const res = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'hybrid' as never,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric agent id with 400', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 'abc' as never }).patch({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when updating a missing agent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 }).patch({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when regenerating the key of a missing agent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 })['regenerate-key'].post();
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting a missing agent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 }).delete();
    expect(res.status).toBe(404);
  });

  it('does not reach an agent through another project (404)', async () => {
    const { asOwner } = await setup();
    await asOwner.projects.post({ key: 'ENG', name: 'Engineering' });
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const agentId = created.data!.agent.id;
    // The same owner addresses the agent through a different project it owns; the
    // store scopes every lookup to (agentId, projectId), so it is not found here.
    const res = await asOwner.projects({ projectKey: 'ENG' })['ai-agents']({ agentId }).patch({
      name: 'x',
    });
    expect(res.status).toBe(404);
  });

  it('denies a non-member (403) on read and write routes', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' });
    const agentId = created.data!.agent.id;
    const asOutsider = agents(authedApi((await signUpTestUser()).cookie));

    expect((await asOutsider.get()).status).toBe(403);
    expect((await asOutsider.tools.get()).status).toBe(403);
    expect((await asOutsider.post({ name: 'X', username: 'x', kind: 'external' })).status).toBe(
      403,
    );
    expect((await asOutsider({ agentId }).patch({ name: 'X' })).status).toBe(403);
    expect((await asOutsider({ agentId })['regenerate-key'].post()).status).toBe(403);
    expect((await asOutsider({ agentId }).run.post({ prompt: 'hi' })).status).toBe(403);
    expect((await asOutsider({ agentId }).delete()).status).toBe(403);
  });

  // The run happy path calls the model provider, so it is exercised out of band,
  // not in this suite. Here we only assert the guards that run before any model call.
  it('returns 404 when running a missing agent', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 }).run.post({ prompt: 'hi' });
    expect(res.status).toBe(404);
  });

  it('rejects running an external agent with 400', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Ext', username: 'ext', kind: 'external' });
    const res = await agents(asOwner)({ agentId: created.data!.agent.id }).run.post({
      prompt: 'hi',
    });
    expect(res.status).toBe(400);
  });

  it('rejects running with an empty prompt (400) before any model call', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' });
    const res = await agents(asOwner)({ agentId: created.data!.agent.id }).run.post({ prompt: '' });
    expect(res.status).toBe(400);
  });
});
