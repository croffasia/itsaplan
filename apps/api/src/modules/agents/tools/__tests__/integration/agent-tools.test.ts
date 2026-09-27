import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createCredential } from '#tests/helpers/integrations';
import { untaggedRoutes } from '#tests/helpers/mcp';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';
import { createAgent } from '#tests/helpers/agents';

// Configured tools of a team, shared by every project it owns: a catalog tool bound to
// an integration credential. The secret lives on the credential, so a configured tool
// carries no secret. Access is the agent_tools permission resource, resolved on the
// team.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

const tools = (api: Api, teamId: number) => api.teams({ teamId })['agent-tools'];
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

// Creates a Jina credential on the team that owns MKT and returns its id.
function jinaCredential(asOwner: Api): Promise<number> {
  return createCredential(asOwner, 'MKT', {
    integrationKey: 'jina',
    credential: { apiKey: 'jina-key-1234' },
  });
}

describe('agent tools', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('binds a tool to a credential and lists it with the integration', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const res = await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      teamId,
      toolKey: 'jina_reader',
      credentialId,
      integrationKey: 'jina',
    });

    const list = await tools(asOwner, teamId).get();
    expect(list.data?.items).toHaveLength(1);
  });

  it('rejects an unknown tool', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const res = await tools(asOwner, teamId).post({ toolKey: 'not-a-tool', credentialId });
    expect(res.status).toBe(400);
  });

  it('rejects binding a tool to a credential of a different integration', async () => {
    const { asOwner, teamId } = await setup();
    const openaiId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'openai',
      credential: { apiKey: 'sk-1' },
    });
    const res = await tools(asOwner, teamId).post({
      toolKey: 'jina_reader',
      credentialId: openaiId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects the same tool on the same credential twice', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await jinaCredential(asOwner);
    await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });
    const dup = await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });
    expect(dup.status).toBe(409);
  });

  it('binds different Jina tools to different credentials', async () => {
    const { asOwner, teamId } = await setup();
    const keyA = await jinaCredential(asOwner);
    const keyB = await createCredential(asOwner, 'MKT', {
      integrationKey: 'jina',
      label: 'B',
      credential: { apiKey: 'jina-b' },
    });
    expect(
      (await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId: keyA })).status,
    ).toBe(201);
    expect(
      (await tools(asOwner, teamId).post({ toolKey: 'jina_search', credentialId: keyB })).status,
    ).toBe(201);
    expect((await tools(asOwner, teamId).get()).data?.items).toHaveLength(2);
  });

  it('pages the list, while the options route answers with all of it', async () => {
    const { asOwner, teamId } = await setup();
    const keyA = await jinaCredential(asOwner);
    const keyB = await createCredential(asOwner, 'MKT', {
      integrationKey: 'jina',
      label: 'B',
      credential: { apiKey: 'jina-b' },
    });
    await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId: keyA });
    await tools(asOwner, teamId).post({ toolKey: 'jina_search', credentialId: keyB });

    const first = await tools(asOwner, teamId).get({ query: { page: 1, pageSize: 1 } });
    expect(first.data).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(first.data?.items).toHaveLength(1);

    const second = await tools(asOwner, teamId).get({ query: { page: 2, pageSize: 1 } });
    expect(second.data?.items).toHaveLength(1);
    expect(second.data?.items[0].id).not.toBe(first.data!.items[0].id);

    expect((await tools(asOwner, teamId).options.get()).data).toHaveLength(2);
  });

  it('serves one configured tool to every project of the team', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.teams({ teamId }).projects.post({ key: 'SUP', name: 'Support' });
    const credentialId = await jinaCredential(asOwner);
    const tool = await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });

    const agent = await createAgent(asOwner, 'SUP', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const set = await agents(
      asOwner,
      teamId,
    )({ agentId: agent.data!.agent.id })['tool-configs'].put({ agentToolIds: [tool.data!.id] });
    expect(set.data?.map((t) => t.id)).toEqual([tool.data!.id]);
  });

  it('deletes a configured tool', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const created = await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });
    const del = await tools(asOwner, teamId)({ agentToolId: created.data!.id }).delete();
    expect(del.status).toBe(204);
    expect((await tools(asOwner, teamId).get()).data?.items).toHaveLength(0);
  });

  it('enables tools on an internal agent and lists them', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const tool = await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = agent.data!.agent.id;

    const set = await agents(
      asOwner,
      teamId,
    )({ agentId })['tool-configs'].put({
      agentToolIds: [tool.data!.id],
    });
    expect(set.status).toBe(200);
    expect(set.data).toHaveLength(1);

    const list = await agents(asOwner, teamId)({ agentId })['tool-configs'].get();
    expect(list.data?.map((t) => t.id)).toEqual([tool.data!.id]);

    const clear = await agents(
      asOwner,
      teamId,
    )({ agentId })['tool-configs'].put({ agentToolIds: [] });
    expect(clear.data).toHaveLength(0);
  });

  it('ignores a tool of another team when enabling tools on an agent', async () => {
    const { asOwner, teamId } = await setup();
    const mine = await tools(asOwner, teamId).post({
      toolKey: 'jina_reader',
      credentialId: await jinaCredential(asOwner),
    });
    const otherTeam = await asOwner.teams.post({ name: 'Design', slug: 'design' });
    await asOwner
      .teams({ teamId: otherTeam.data!.id })
      .projects.post({ key: 'DSG', name: 'Design' });
    const theirs = await tools(asOwner, otherTeam.data!.id).post({
      toolKey: 'jina_reader',
      credentialId: await createCredential(asOwner, 'DSG', {
        integrationKey: 'jina',
        credential: { apiKey: 'jina-other' },
      }),
    });
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });

    const set = await agents(
      asOwner,
      teamId,
    )({ agentId: agent.data!.agent.id })['tool-configs'].put({
      agentToolIds: [mine.data!.id, theirs.data!.id],
    });
    expect(set.data?.map((t) => t.id)).toEqual([mine.data!.id]);
  });

  // Over MCP a configured tool can be read and enabled on an agent, but binding one to
  // a credential stays in the UI, where the credential is added.
  it('exposes reading and enabling configured tools to MCP, not binding one', () => {
    const untagged = untaggedRoutes(
      (route) => route.includes('agent-tools') || route.includes('tool-configs'),
    );
    expect(untagged).toEqual([
      'POST /teams/:teamId/agent-tools',
      'DELETE /teams/:teamId/agent-tools/:agentToolId',
    ]);
  });

  it('lets a team member read the tools when their project role grants it', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await jinaCredential(asOwner);
    await tools(asOwner, teamId).post({ toolKey: 'jina_reader', credentialId });
    const role = await createRole(asOwner, 'MKT', {
      name: 'Tool reader',
      permissions: { agent_tools: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    const list = await tools(asMember, teamId).get();
    expect(list.status).toBe(200);
    expect(list.data?.items).toHaveLength(1);
    // Reading is all that role grants.
    expect(
      (await tools(asMember, teamId).post({ toolKey: 'jina_search', credentialId })).status,
    ).toBe(403);
  });

  it('hides the team from someone who does not belong to it', async () => {
    const { teamId } = await setup();
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);
    expect((await tools(asOutsider, teamId).get()).status).toBe(404);
    expect(
      (await tools(asOutsider, teamId).post({ toolKey: 'jina_reader', credentialId: 1 })).status,
    ).toBe(404);
  });
});
