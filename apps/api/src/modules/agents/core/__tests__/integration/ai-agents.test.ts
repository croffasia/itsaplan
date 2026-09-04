import { describe, it, expect, beforeEach } from 'bun:test';
import { apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { untaggedRoutes } from '#tests/helpers/mcp';

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

async function createCredential(api: Api, projectKey = 'MKT'): Promise<number> {
  const res = await api.projects({ projectKey }).integrations.post({
    integrationKey: 'openai',
    credential: { apiKey: 'sk-secret-1234' },
  });
  return res.data!.id;
}

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

  it('binds a model credential of the project to an internal agent', async () => {
    const { asOwner } = await setup();
    const credentialId = await createCredential(asOwner);
    const res = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: credentialId,
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({
      modelCredentialId: credentialId,
      modelProvider: 'openai',
    });
  });

  it('rejects an unknown model credential with 400 on create', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: 999999,
    });
    expect(res.status).toBe(400);
  });

  it("rejects another project's model credential with 400", async () => {
    const { asOwner } = await setup();
    await asOwner.projects.post({ key: 'ENG', name: 'Engineering' });
    const foreignCredentialId = await createCredential(asOwner, 'ENG');
    const res = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: foreignCredentialId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a tool credential as the model credential with 400', async () => {
    const { asOwner } = await setup();
    const created = await asOwner.projects({ projectKey: 'MKT' }).integrations.post({
      integrationKey: 'jina',
      credential: { apiKey: 'jina_secret' },
    });
    const res = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: created.data!.id,
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown model credential with 400 on update and keeps the stored one', async () => {
    const { asOwner } = await setup();
    const credentialId = await createCredential(asOwner);
    const created = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: credentialId,
    });
    const agentId = created.data!.agent.id;
    const res = await agents(asOwner)({ agentId }).patch({
      name: 'Renamed',
      modelCredentialId: 999999,
    });
    expect(res.status).toBe(400);
    expect((await agents(asOwner)({ agentId }).get()).data).toMatchObject({
      name: 'Bot',
      modelCredentialId: credentialId,
    });
  });

  it('clears the model credential with null', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: await createCredential(asOwner),
    });
    const res = await agents(asOwner)({ agentId: created.data!.agent.id }).patch({
      modelCredentialId: null,
    });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ modelCredentialId: null, modelProvider: null });
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

  it("puts an external agent on the project's default role when none is given", async () => {
    const { asOwner } = await setup();
    const roles = await asOwner.projects({ projectKey: 'MKT' }).roles.get();
    const defaultRole = roles.data!.find((r) => r.isDefault)!;

    const created = await agents(asOwner).post({ name: 'Ext', username: 'ext', kind: 'external' });
    expect(created.data?.agent).toMatchObject({ roleId: defaultRole.id });

    // Clearing the role falls back to the same default rather than leaving the agent
    // on the built-in permissions.
    const cleared = await agents(asOwner)({ agentId: created.data!.agent.id }).patch({
      roleId: null,
    });
    expect(cleared.data).toMatchObject({ roleId: defaultRole.id });
  });

  it('rejects a role from another project for an external agent', async () => {
    const { asOwner } = await setup();
    await asOwner.projects.post({ key: 'ENG', name: 'Engineering' });
    const foreign = await asOwner.projects({ projectKey: 'ENG' }).roles.get();

    const res = await agents(asOwner).post({
      name: 'Ext',
      username: 'ext',
      kind: 'external',
      roleId: foreign.data![0].id,
    });
    expect(res.status).toBe(400);
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
    expect(agent?.restrictedToUserId).toBeNull();
  });

  it("names the owner of an 'owner'-scoped agent as an assignee candidate", async () => {
    const { owner, asOwner } = await setup();
    const created = await agents(asOwner).post({
      name: 'Mine Only',
      username: 'mine',
      kind: 'external',
      runnerScope: 'owner',
    });
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    const agent = project.data?.assignees.find((a) => a.userId === created.data!.agent.userId);
    expect(agent?.restrictedToUserId).toBe(owner.userId);

    // Widening the scope drops the restriction: any member's runs reach the runner.
    await agents(asOwner)({ agentId: created.data!.agent.id }).patch({ runnerScope: 'project' });
    const widened = await asOwner.projects({ projectKey: 'MKT' }).get();
    expect(
      widened.data?.assignees.find((a) => a.userId === created.data!.agent.userId)
        ?.restrictedToUserId,
    ).toBeNull();
  });

  it("hands an 'owner'-scoped agent to the member who chose the scope", async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Ext', username: 'ext', kind: 'external' });
    const second = await signUpTestUser({ name: 'Second' });
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: second.email, role: 'owner' });
    const asSecond = authedApi(second.cookie);
    await asSecond.invites({ token: invite.data!.token }).accept.post();

    const res = await agents(asSecond)({ agentId: created.data!.agent.id }).patch({
      runnerScope: 'owner',
    });
    expect(res.data).toMatchObject({ runnerScope: 'owner', ownerUserId: second.userId });
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

  it('links the member fields the agent reacts to, and drops the ids of other fields', async () => {
    const { asOwner } = await setup();
    const fields = asOwner.projects({ projectKey: 'MKT' })['custom-fields'];
    const reviewer = (
      await fields.post({ name: 'Reviewer', fieldType: 'member', memberScope: 'agents' })
    ).data!;
    // A field the agents cannot be set into carries no trigger, so its id is dropped.
    const owner = (await fields.post({ name: 'Owner', fieldType: 'member', memberScope: 'humans' }))
      .data!;
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' });
    const agentId = created.data!.agent.id;
    expect(created.data!.agent.fieldTriggers).toEqual([]);

    const res = await agents(asOwner)({ agentId }).patch({
      fieldTriggers: [
        { fieldId: reviewer.id, delaySec: 300 },
        { fieldId: owner.id, delaySec: 0 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.data?.fieldTriggers).toEqual([{ fieldId: reviewer.id, delaySec: 300 }]);

    const cleared = await agents(asOwner)({ agentId }).patch({ fieldTriggers: [] });
    expect(cleared.data?.fieldTriggers).toEqual([]);
  });

  it('deletes an agent and drops it from assignee candidates', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const agentId = created.data!.agent.id;
    const asAgent = apiKeyApi(created.data!.apiKey!);
    const agentDocuments = asAgent.projects({ projectKey: 'MKT' }).documents;
    const shared = (await agentDocuments.post({ title: 'Agent handbook' })).data!;
    const privatePage = (
      await agentDocuments.post({ title: 'Agent private notes', isPrivate: true })
    ).data!;
    const del = await agents(asOwner)({ agentId }).delete();
    expect(del.status).toBe(204);
    const list = await agents(asOwner).get();
    expect(list.data).toHaveLength(0);
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    expect(project.data?.assignees.some((a) => a.kind === 'agent')).toBe(false);
    expect(
      (await asOwner.projects({ projectKey: 'MKT' }).documents({ documentId: shared.id }).get())
        .data,
    ).toMatchObject({ ownerUserId: null, isPrivate: false });
    expect(
      (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .documents({ documentId: privatePage.id })
          .get()
      ).status,
    ).toBe(404);
  });

  it('rejects a duplicate username with 409', async () => {
    const { asOwner } = await setup();
    await agents(asOwner).post({ name: 'First', username: 'dup', kind: 'external' });
    const res = await agents(asOwner).post({ name: 'Second', username: 'dup', kind: 'external' });
    expect(res.status).toBe(409);
  });

  // A mention is resolved against the project's members and its agents at once, so a
  // handle a member already answers to cannot be given to an agent.
  it('rejects a username a member already uses with 409', async () => {
    const { owner, asOwner } = await setup();
    const res = await agents(asOwner).post({
      name: 'Impostor',
      username: owner.username,
      kind: 'external',
    });
    expect(res.status).toBe(409);
  });

  // A handle is resolved lowercased, so two agents differing only by case would both
  // answer to it.
  it('rejects a username another agent uses in another case with 409', async () => {
    const { asOwner } = await setup();
    await agents(asOwner).post({ name: 'First', username: 'Dup', kind: 'external' });
    const res = await agents(asOwner).post({ name: 'Second', username: 'dup', kind: 'external' });
    expect(res.status).toBe(409);
  });

  it('keeps an agent its own username on an unrelated change', async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const res = await agents(asOwner)({ agentId: created.data!.agent.id }).patch({
      username: 'bot',
      name: 'Bot renamed',
    });
    expect(res.status).toBe(200);
  });

  it('rejects renaming an agent onto a member username with 409', async () => {
    const { owner, asOwner } = await setup();
    const created = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'external' });
    const res = await agents(asOwner)({ agentId: created.data!.agent.id }).patch({
      username: owner.username,
    });
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

  // An agent is set up and talked to entirely over MCP. What stays out serves the chat
  // UI: the streamed run and the caller's own thread history, plus this agent's run
  // history — the analytics routes carry the project-wide run feed MCP reads instead.
  it('exposes agent management and the run to MCP', () => {
    const untagged = untaggedRoutes((route) => route.includes('/ai-agents'));
    expect(untagged).toEqual([
      'GET /projects/:projectKey/ai-agents/:agentId/runs',
      'POST /projects/:projectKey/ai-agents/:agentId/run/stream',
      'GET /projects/:projectKey/ai-agents/:agentId/threads',
      'PUT /projects/:projectKey/ai-agents/:agentId/threads/:threadId/favorite',
      'DELETE /projects/:projectKey/ai-agents/:agentId/threads/:threadId/favorite',
      'GET /projects/:projectKey/ai-agents/:agentId/threads/:threadId/messages',
      'PATCH /projects/:projectKey/ai-agents/:agentId/threads/:threadId',
      'DELETE /projects/:projectKey/ai-agents/:agentId/threads/:threadId',
      'POST /projects/:projectKey/ai-agents/:agentId/chat',
      'GET /projects/:projectKey/ai-agents/:agentId/chat/:messageId/events',
      'GET /projects/:projectKey/ai-agents/:agentId/chat/:messageId/stream',
      'POST /projects/:projectKey/ai-agents/:agentId/chat/:messageId/cancel',
    ]);
  });
});
