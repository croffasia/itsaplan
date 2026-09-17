import { describe, it, expect, beforeEach } from 'bun:test';
import { apikey, db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { createRole, listProjectRoles } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { untaggedRoutes } from '#tests/helpers/mcp';

// AI agents owned by a team. Each agent is backed by a hidden bot user, owns a
// better-auth API key, and is a member of the projects it is attached to, acting under
// a team role. An external agent needs only a name + username, and its operator gets
// the key secret (returned once on create and again on regenerate); an internal agent
// adds a model configuration and its key stays server-side for its own runtime. An
// agent shows up as an assignee candidate in the projects it works in. Access is the
// ai_agents permission resource on the team.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

// The agent routes of the team the project belongs to, which is where agents live.
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

function openAiCredential(api: Api, projectKey = 'MKT'): Promise<number> {
  return createCredential(api, projectKey, {
    integrationKey: 'openai',
    credential: { apiKey: 'sk-secret-1234' },
  });
}

describe('ai agents', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates an external agent and returns its key once', async () => {
    const { asOwner } = await setup();
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Webhook Bot',
      username: 'webhook',
      kind: 'external',
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({
      name: 'Webhook Bot',
      username: 'webhook',
      kind: 'external',
      // Any member of the team may trigger it unless the scope is narrowed.
      runnerScope: 'team',
    });
    expect(typeof res.data?.apiKey).toBe('string');
    expect(res.data?.apiKey?.length ?? 0).toBeGreaterThan(10);
    // The key start is kept for display; the secret itself is not on the row.
    expect(res.data?.agent.apiKeyStart).toBeTruthy();
  });

  it('lists the tool catalog: grantable actions plus always-on read tools', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId).tools.get();
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
    const res = await createAgent(asOwner, 'MKT', {
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
    const res = await createAgent(asOwner, 'MKT', {
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
    const credentialId = await openAiCredential(asOwner);
    const res = await createAgent(asOwner, 'MKT', {
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
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: 999999,
    });
    expect(res.status).toBe(400);
  });

  it("rejects another team's model credential with 400", async () => {
    const { asOwner } = await setup();
    const otherTeam = await asOwner.teams.post({ name: 'Engineering' });
    await asOwner.teams({ teamId: otherTeam.data!.id }).projects.post({
      key: 'ENG',
      name: 'Engineering',
    });
    const foreignCredentialId = await openAiCredential(asOwner, 'ENG');
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: foreignCredentialId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a tool credential as the model credential with 400', async () => {
    const { asOwner } = await setup();
    const toolCredentialId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'jina',
      credential: { apiKey: 'jina_secret' },
    });
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: toolCredentialId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown model credential with 400 on update and keeps the stored one', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await openAiCredential(asOwner);
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: credentialId,
    });
    const agentId = created.data!.agent.id;
    const res = await agents(
      asOwner,
      teamId,
    )({ agentId }).patch({
      name: 'Renamed',
      modelCredentialId: 999999,
    });
    expect(res.status).toBe(400);
    expect((await agents(asOwner, teamId)({ agentId }).get()).data).toMatchObject({
      name: 'Bot',
      modelCredentialId: credentialId,
    });
  });

  it('clears the model credential with null', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
      modelCredentialId: await openAiCredential(asOwner),
    });
    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id }).patch({
      modelCredentialId: null,
    });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ modelCredentialId: null, modelProvider: null });
  });

  it('stores conversation memory config on an internal agent', async () => {
    const { asOwner, teamId } = await setup();
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Memo Bot',
      username: 'memo',
      kind: 'internal',
      memoryEnabled: true,
      memoryLastMessages: 15,
    });
    expect(res.status).toBe(201);
    expect(res.data?.agent).toMatchObject({ memoryEnabled: true, memoryLastMessages: 15 });
    const upd = await agents(
      asOwner,
      teamId,
    )({ agentId: res.data!.agent.id }).patch({
      memoryEnabled: false,
    });
    expect(upd.data).toMatchObject({ memoryEnabled: false, memoryLastMessages: 15 });
  });

  it("defaults an internal agent's triggers and stores overrides", async () => {
    const { asOwner, teamId } = await setup();
    const def = await createAgent(asOwner, 'MKT', { name: 'T1', username: 't1', kind: 'internal' });
    expect(def.data?.agent).toMatchObject({ triggerOnMention: true, triggerOnAssign: false });

    const custom = await createAgent(asOwner, 'MKT', {
      name: 'T2',
      username: 't2',
      kind: 'internal',
      triggerOnMention: false,
      triggerOnAssign: true,
    });
    expect(custom.data?.agent).toMatchObject({ triggerOnMention: false, triggerOnAssign: true });

    const upd = await agents(
      asOwner,
      teamId,
    )({ agentId: custom.data!.agent.id }).patch({
      triggerOnMention: true,
    });
    expect(upd.data).toMatchObject({ triggerOnMention: true, triggerOnAssign: true });
  });

  it("attaches an agent to a project on the team's default role", async () => {
    const { asOwner } = await setup();
    const roles = await listProjectRoles(asOwner, 'MKT');
    const defaultRole = roles.data!.find((r) => r.isDefault)!;
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Ext',
      username: 'ext',
      kind: 'external',
    });
    expect(created.status).toBe(201);

    // The membership is what the permission checks read, so that is where the role is:
    // the agent joins on the default one and the members list reassigns it per project.
    const members = await asOwner.projects({ projectKey: 'MKT' }).members.get({ query: {} });
    const bot = members.data!.items.find((m) => m.userId === created.data!.agent.userId);
    expect(bot).toMatchObject({ isAgent: true, role: 'member', roleId: defaultRole.id });
  });

  it('refuses to make an agent a project owner (400)', async () => {
    const { asOwner } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Ext',
      username: 'ext',
      kind: 'external',
    });
    // An owner bypasses the permission matrix; an agent only ever works under a role.
    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      .members({ userId: created.data!.agent.userId })
      .patch({ role: 'owner' });
    expect(res.status).toBe(400);
  });

  it("closes the team's owner and manager guards to an agent key", async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Ext',
      username: 'ext',
      kind: 'external',
    });
    const asAgent = apiKeyApi(created.data!.apiKey!);

    // An agent belongs to the team's member list, so it reads the team; it never runs
    // it, so renaming the team and creating a project in it are closed to it.
    expect((await asAgent.teams({ teamId }).get()).status).toBe(200);
    expect((await asAgent.teams({ teamId }).patch({ name: 'Renamed' })).status).toBe(403);
    expect(
      (await asAgent.teams({ teamId }).projects.post({ key: 'ENG', name: 'Engineering' })).status,
    ).toBe(403);
  });

  it('lists agents without the secret', async () => {
    const { asOwner, teamId } = await setup();
    await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind: 'external' });
    const res = await agents(asOwner, teamId).get();
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]).not.toHaveProperty('apiKey');
    expect(res.data?.[0].apiKeyStart).toBeTruthy();
  });

  it('gets one agent by id, without the secret', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const agentId = created.data!.agent.id;

    const res = await agents(asOwner, teamId)({ agentId }).get();
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: agentId, name: 'Bot', username: 'bot' });
    expect(res.data).not.toHaveProperty('apiKey');
  });

  it('returns 404 for a missing agent', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 999999 }).get();
    expect(res.status).toBe(404);
  });

  it('exposes the created agent as an assignee candidate', async () => {
    const { asOwner } = await setup();
    await createAgent(asOwner, 'MKT', {
      name: 'Assign Me',
      username: 'assignme',
      kind: 'external',
    });
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    const agent = project.data?.assignees.find((a) => a.kind === 'agent');
    expect(agent).toMatchObject({ name: 'Assign Me', kind: 'agent', agentKind: 'external' });
    expect(agent?.restrictedToUserId).toBeNull();
  });

  it("names the owner of an 'owner'-scoped agent as an assignee candidate", async () => {
    const { owner, asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Mine Only',
      username: 'mine',
      kind: 'external',
      runnerScope: 'owner',
    });
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    const agent = project.data?.assignees.find((a) => a.userId === created.data!.agent.userId);
    expect(agent?.restrictedToUserId).toBe(owner.userId);

    // Widening the scope drops the restriction: any member's runs reach the runner.
    await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id }).patch({ runnerScope: 'team' });
    const widened = await asOwner.projects({ projectKey: 'MKT' }).get();
    expect(
      widened.data?.assignees.find((a) => a.userId === created.data!.agent.userId)
        ?.restrictedToUserId,
    ).toBeNull();
  });

  it("hands an 'owner'-scoped agent to the member who chose the scope", async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Ext',
      username: 'ext',
      kind: 'external',
    });
    const second = await signUpTestUser({ name: 'Second' });
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: second.email, role: 'owner' });
    const asSecond = authedApi(second.cookie);
    await asSecond.invites({ token: invite.data!.token }).accept.post();

    const res = await agents(
      asSecond,
      teamId,
    )({ agentId: created.data!.agent.id }).patch({
      runnerScope: 'owner',
    });
    expect(res.data).toMatchObject({ runnerScope: 'owner', ownerUserId: second.userId });
  });

  it('regenerates the key with a new secret', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const agentId = created.data!.agent.id;
    const res = await agents(asOwner, teamId)({ agentId })['regenerate-key'].post();
    expect(res.status).toBe(200);
    expect(res.data?.apiKey).toBeTruthy();
    expect(res.data?.apiKey).not.toBe(created.data?.apiKey);
  });

  // A personal key expires; an agent replays its key with nothing that would renew
  // it, so the one issued at creation and the one regenerate-key issues carry none.
  it('issues the agent key without an expiry', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const agent = created.data!.agent;
    const expiries = () =>
      db
        .select({ expiresAt: apikey.expiresAt })
        .from(apikey)
        .where(eq(apikey.referenceId, agent.userId));

    expect(await expiries()).toEqual([{ expiresAt: null }]);

    await agents(asOwner, teamId)({ agentId: agent.id })['regenerate-key'].post();
    expect(await expiries()).toEqual([{ expiresAt: null }]);
  });

  it('rejects regenerating the key on an internal agent with 400', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id })['regenerate-key'].post();
    expect(res.status).toBe(400);
  });

  it('updates name, config, and tools', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = created.data!.agent.id;
    const res = await agents(
      asOwner,
      teamId,
    )({ agentId }).patch({
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
    const { asOwner, teamId } = await setup();
    const fields = asOwner.projects({ projectKey: 'MKT' })['custom-fields'];
    const reviewer = (
      await fields.post({ name: 'Reviewer', fieldType: 'member', memberScope: 'agents' })
    ).data!;
    // A field the agents cannot be set into carries no trigger, so its id is dropped.
    const owner = (await fields.post({ name: 'Owner', fieldType: 'member', memberScope: 'humans' }))
      .data!;
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = created.data!.agent.id;
    expect(created.data!.agent.fieldTriggers).toEqual([]);

    const res = await agents(
      asOwner,
      teamId,
    )({ agentId }).patch({
      fieldTriggers: [
        { fieldId: reviewer.id, delaySec: 300 },
        { fieldId: owner.id, delaySec: 0 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.data?.fieldTriggers).toEqual([
      { fieldId: reviewer.id, name: 'Reviewer', delaySec: 300 },
    ]);

    const cleared = await agents(asOwner, teamId)({ agentId }).patch({ fieldTriggers: [] });
    expect(cleared.data?.fieldTriggers).toEqual([]);
  });

  it('deletes an agent and drops it from assignee candidates', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const agentId = created.data!.agent.id;
    const asAgent = apiKeyApi(created.data!.apiKey!);
    const agentDocuments = asAgent.projects({ projectKey: 'MKT' }).documents;
    const shared = (await agentDocuments.post({ title: 'Agent handbook' })).data!;
    const privatePage = (
      await agentDocuments.post({ title: 'Agent private notes', isPrivate: true })
    ).data!;
    const del = await agents(asOwner, teamId)({ agentId }).delete();
    expect(del.status).toBe(204);
    const list = await agents(asOwner, teamId).get();
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
    await createAgent(asOwner, 'MKT', { name: 'First', username: 'dup', kind: 'external' });
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Second',
      username: 'dup',
      kind: 'external',
    });
    expect(res.status).toBe(409);
  });

  // A mention is resolved against the project's members and its agents at once, so a
  // handle a member already answers to cannot be given to an agent.
  it('rejects a username a member already uses with 409', async () => {
    const { owner, asOwner } = await setup();
    const res = await createAgent(asOwner, 'MKT', {
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
    await createAgent(asOwner, 'MKT', { name: 'First', username: 'Dup', kind: 'external' });
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Second',
      username: 'dup',
      kind: 'external',
    });
    expect(res.status).toBe(409);
  });

  it('keeps an agent its own username on an unrelated change', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id }).patch({
      username: 'bot',
      name: 'Bot renamed',
    });
    expect(res.status).toBe(200);
  });

  it('rejects renaming an agent onto a member username with 409', async () => {
    const { owner, asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id }).patch({
      username: owner.username,
    });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid username with 400', async () => {
    const { asOwner } = await setup();
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Bad',
      username: 'has spaces',
      kind: 'external',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an empty name with 400', async () => {
    const { asOwner } = await setup();
    const res = await createAgent(asOwner, 'MKT', { name: '', username: 'bot', kind: 'external' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown kind with 400', async () => {
    const { asOwner } = await setup();
    // kind must be "external" | "internal".
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'hybrid' as never,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric agent id with 400', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 'abc' as never }).patch({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when updating a missing agent', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 999999 }).patch({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when regenerating the key of a missing agent', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 999999 })['regenerate-key'].post();
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting a missing agent', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 999999 }).delete();
    expect(res.status).toBe(404);
  });

  it('does not reach an agent through another team (404)', async () => {
    const { asOwner } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const agentId = created.data!.agent.id;
    // A second account addresses the agent through its own team, where the store finds
    // nothing: every lookup is scoped to (agentId, teamId).
    const second = authedApi((await signUpTestUser()).cookie);
    const otherProject = await second.projects.post({ key: 'ENG', name: 'Engineering' });
    const res = await agents(second, otherProject.data!.teamId)({ agentId }).patch({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('lists only the agents working in the project the filter names', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'ENG', name: 'Engineering' });
    await createAgent(asOwner, 'MKT', { name: 'Mkt Bot', username: 'mkt-bot', kind: 'external' });
    await createAgent(asOwner, 'ENG', { name: 'Eng Bot', username: 'eng-bot', kind: 'external' });

    const all = await agents(asOwner, teamId).get();
    expect(all.data).toHaveLength(2);
    const filtered = await agents(asOwner, teamId).get({
      query: { projectId: await projectIdOf(asOwner, 'ENG') },
    });
    expect(filtered.data?.map((a) => a.username)).toEqual(['eng-bot']);
  });

  it('attaches an agent to a second project and detaches it again', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'ENG', name: 'Engineering' });
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const agentId = created.data!.agent.id;
    const mkt = await projectIdOf(asOwner, 'MKT');
    const eng = await projectIdOf(asOwner, 'ENG');

    const attached = await agents(
      asOwner,
      teamId,
    )({ agentId }).projects.put({
      projectIds: [mkt, eng],
    });
    expect(attached.data?.projects.map((p) => p.key).sort()).toEqual(['ENG', 'MKT']);

    const detached = await agents(asOwner, teamId)({ agentId }).projects.put({ projectIds: [eng] });
    expect(detached.data?.projects.map((p) => p.key)).toEqual(['ENG']);
  });

  it('refuses a project of another team (400)', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const second = authedApi((await signUpTestUser()).cookie);
    await second.projects.post({ key: 'ENG', name: 'Engineering' });

    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id }).projects.put({
      projectIds: [await projectIdOf(second, 'ENG')],
    });
    expect(res.status).toBe(400);
  });

  it('denies a non-member (403) on read and write routes', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = created.data!.agent.id;
    // A team the caller does not belong to reads as one that does not exist, so the
    // team routes answer 404; the project run route stays a 403.
    const outsider = authedApi((await signUpTestUser()).cookie);
    const asOutsider = agents(outsider, teamId);

    expect((await asOutsider.get()).status).toBe(404);
    expect((await asOutsider.tools.get()).status).toBe(404);
    expect((await asOutsider.post({ name: 'X', username: 'x', kind: 'external' })).status).toBe(
      404,
    );
    expect((await asOutsider({ agentId }).patch({ name: 'X' })).status).toBe(404);
    expect((await asOutsider({ agentId })['regenerate-key'].post()).status).toBe(404);
    expect((await asOutsider({ agentId }).delete()).status).toBe(404);
    expect(
      (
        await outsider
          .projects({ projectKey: 'MKT' })
          ['ai-agents']({ agentId })
          .run.post({ prompt: 'hi' })
      ).status,
    ).toBe(403);
  });

  // The run happy path calls the model provider, so it is exercised out of band,
  // not in this suite. Here we only assert the guards that run before any model call.
  it('returns 404 when running a missing agent', async () => {
    const { asOwner } = await setup();
    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: 999999 })
      .run.post({ prompt: 'hi' });
    expect(res.status).toBe(404);
  });

  it('rejects running an external agent with 400', async () => {
    const { asOwner } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Ext',
      username: 'ext',
      kind: 'external',
    });
    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: created.data!.agent.id })
      .run.post({ prompt: 'hi' });
    expect(res.status).toBe(400);
  });

  it('rejects running with an empty prompt (400) before any model call', async () => {
    const { asOwner } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: created.data!.agent.id })
      .run.post({ prompt: '' });
    expect(res.status).toBe(400);
  });

  describe('visibility', () => {
    // The ai_agents permission is merged from every project role the caller holds in
    // the team, so it says what they may do, not to which agents. A member reaches only
    // the agents working in a project they are in; the team's owner reaches them all.
    it('scopes a member to the agents of the projects they joined', async () => {
      const { asOwner, teamId } = await setup();
      await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      const mine = await createAgent(asOwner, 'MKT', {
        name: 'Marketing Bot',
        username: 'mkt-bot',
        kind: 'external',
      });
      const theirs = await createAgent(asOwner, 'OPS', {
        name: 'Ops Bot',
        username: 'ops-bot',
        kind: 'external',
      });
      const role = await createRole(asOwner, 'MKT', {
        name: 'Agent handler',
        permissions: {
          ai_agents: { read: true, edit: true, delete: true },
          agent_skills: { read: true },
        },
      });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

      const list = await agents(asMember, teamId).get();
      expect(list.data?.map((a) => a.username)).toEqual(['mkt-bot']);

      const hidden = agents(asMember, teamId)({ agentId: theirs.data!.agent.id });
      expect((await hidden.get()).status).toBe(404);
      expect((await hidden.patch({ name: 'Renamed' })).status).toBe(404);
      expect((await hidden.delete()).status).toBe(404);
      expect((await hidden.skills.get()).status).toBe(404);

      const own = agents(asMember, teamId)({ agentId: mine.data!.agent.id });
      expect((await own.get()).status).toBe(200);
      expect((await own.patch({ name: 'Renamed' })).status).toBe(200);

      // The owner runs the team, so both agents stay theirs.
      const all = await agents(asOwner, teamId).get();
      expect(all.data?.map((a) => a.username).sort()).toEqual(['mkt-bot', 'ops-bot']);
    });
  });

  // Where an agent may work is bounded by the projects of the caller: a member who does
  // not run the team attaches it to their own and to nothing else, and a project of the
  // agent they cannot see stays attached through their edit.
  it('bounds the projects an agent is attached to by the caller’s own', async () => {
    const { asOwner, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const mkt = await projectIdOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
      projectIds: [mkt, ops.data!.id],
    });
    const role = await createRole(asOwner, 'MKT', {
      name: 'Agent handler',
      permissions: { ai_agents: { read: true, create: true, edit: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);
    const agent = agents(asMember, teamId)({ agentId: created.data!.agent.id });

    // OPS is not a project of theirs, so they cannot put an agent there.
    expect((await agent.projects.put({ projectIds: [mkt, ops.data!.id] })).status).toBe(403);
    expect(
      (
        await agents(asMember, teamId).post({
          name: 'Ops bot',
          username: 'ops-bot',
          kind: 'external',
          projectIds: [ops.data!.id],
        })
      ).status,
    ).toBe(403);

    // Their own project is theirs to attach.
    const mine = await agents(asMember, teamId).post({
      name: 'Mkt bot',
      username: 'mkt-bot',
      kind: 'external',
      projectIds: [mkt],
    });
    expect(mine.data?.agent.projects.map((p) => p.key)).toEqual(['MKT']);

    // Their set replaces only what they see: OPS is out of their view and stays.
    const detached = await agent.projects.put({ projectIds: [] });
    expect(detached.status).toBe(200);
    expect(detached.data?.projects.map((p) => p.key)).toEqual(['OPS']);
  });

  // An agent is set up and talked to entirely over MCP. What stays out serves the chat
  // UI: the streamed run and the caller's own thread history, plus this agent's run
  // history — the analytics routes carry the project-wide run feed MCP reads instead.
  it('exposes agent management and the run to MCP', () => {
    const untagged = untaggedRoutes((route) => route.includes('/ai-agents'));
    expect(untagged).toEqual([
      'GET /teams/:teamId/ai-agents/:agentId/runs',
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
