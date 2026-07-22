import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Configured tools for a project: a catalog tool bound to an integration credential.
// The secret lives on the credential, so a configured tool carries no secret. Access
// is the agent_tools permission resource.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner };
}

const tools = (api: Api) => api.projects({ projectKey: 'MKT' })['agent-tools'];
const integrations = (api: Api) => api.projects({ projectKey: 'MKT' }).integrations;
const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

// Creates a Jina credential and returns its id.
async function jinaCredential(asOwner: Api): Promise<number> {
  const res = await integrations(asOwner).post({
    integrationKey: 'jina',
    credential: { apiKey: 'jina-key-1234' },
  });
  return res.data!.id;
}

describe('agent tools', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('binds a tool to a credential and lists it with the integration', async () => {
    const { asOwner } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const res = await tools(asOwner).post({ toolKey: 'jina_reader', credentialId });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      toolKey: 'jina_reader',
      credentialId,
      integrationKey: 'jina',
    });

    const list = await tools(asOwner).get();
    expect(list.data).toHaveLength(1);
  });

  it('rejects an unknown tool', async () => {
    const { asOwner } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const res = await tools(asOwner).post({ toolKey: 'not-a-tool', credentialId });
    expect(res.status).toBe(400);
  });

  it('rejects binding a tool to a credential of a different integration', async () => {
    const { asOwner } = await setup();
    const openai = await integrations(asOwner).post({
      integrationKey: 'openai',
      credential: { apiKey: 'sk-1' },
    });
    const res = await tools(asOwner).post({
      toolKey: 'jina_reader',
      credentialId: openai.data!.id,
    });
    expect(res.status).toBe(400);
  });

  it('binds different Jina tools to different credentials', async () => {
    const { asOwner } = await setup();
    const keyA = await jinaCredential(asOwner);
    const keyB = (
      await integrations(asOwner).post({
        integrationKey: 'jina',
        label: 'B',
        credential: { apiKey: 'jina-b' },
      })
    ).data!.id;
    expect((await tools(asOwner).post({ toolKey: 'jina_reader', credentialId: keyA })).status).toBe(
      201,
    );
    expect((await tools(asOwner).post({ toolKey: 'jina_search', credentialId: keyB })).status).toBe(
      201,
    );
    expect((await tools(asOwner).get()).data).toHaveLength(2);
  });

  it('deletes a configured tool', async () => {
    const { asOwner } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const created = await tools(asOwner).post({ toolKey: 'jina_reader', credentialId });
    const del = await tools(asOwner)({ agentToolId: created.data!.id }).delete();
    expect(del.status).toBe(204);
    expect((await tools(asOwner).get()).data).toHaveLength(0);
  });

  it('enables tools on an internal agent and lists them', async () => {
    const { asOwner } = await setup();
    const credentialId = await jinaCredential(asOwner);
    const tool = await tools(asOwner).post({ toolKey: 'jina_reader', credentialId });
    const agent = await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' });
    const agentId = agent.data!.agent.id;

    const set = await agents(asOwner)({ agentId })['tool-configs'].put({
      agentToolIds: [tool.data!.id],
    });
    expect(set.status).toBe(200);
    expect(set.data).toHaveLength(1);

    const list = await agents(asOwner)({ agentId })['tool-configs'].get();
    expect(list.data?.map((t) => t.id)).toEqual([tool.data!.id]);

    const clear = await agents(asOwner)({ agentId })['tool-configs'].put({ agentToolIds: [] });
    expect(clear.data).toHaveLength(0);
  });

  it('denies a non-member', async () => {
    await setup();
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);
    expect((await tools(asOutsider).get()).status).toBe(403);
    expect((await tools(asOutsider).post({ toolKey: 'jina_reader', credentialId: 1 })).status).toBe(
      403,
    );
  });
});
