import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { untaggedRoutes } from '#tests/helpers/mcp';

// Integration credentials for a project: one store for LLM provider keys (kind 'llm')
// and tool credentials (kind 'tool'). The secret is stored encrypted and never
// returned — a response carries only a redacted view. Access is the integrations
// permission resource.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner };
}

const integrations = (api: Api) => api.projects({ projectKey: 'MKT' }).integrations;
const options = (api: Api) => integrations(api).options;

describe('integrations', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists the catalog with LLM providers and tool integrations', async () => {
    const { asOwner } = await setup();
    const res = await integrations(asOwner).catalog.get();
    expect(res.status).toBe(200);
    expect(res.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'openai', kind: 'llm' }),
        expect.objectContaining({
          key: 'jina',
          kind: 'tool',
          tools: expect.arrayContaining([expect.objectContaining({ key: 'jina_reader' })]),
        }),
      ]),
    );
  });

  it('stores an LLM credential, masks the secret, and never returns the raw value', async () => {
    const { asOwner } = await setup();
    const res = await integrations(asOwner).post({
      integrationKey: 'openai',
      label: 'Team',
      credential: { apiKey: 'sk-secret-1234' },
    });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ integrationKey: 'openai', label: 'Team' });
    expect(res.data!.redacted).toMatchObject({ apiKey: '••••1234' });
    expect(JSON.stringify(res.data)).not.toContain('sk-secret-1234');

    const list = await integrations(asOwner).get();
    expect(list.data).toHaveLength(1);
    expect(JSON.stringify(list.data)).not.toContain('sk-secret');
  });

  it('stores a tool credential (Jina)', async () => {
    const { asOwner } = await setup();
    const res = await integrations(asOwner).post({
      integrationKey: 'jina',
      credential: { apiKey: 'jina-abcd' },
    });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ integrationKey: 'jina' });
  });

  it('stores a Gitea credential, showing the URL and masking the token', async () => {
    const { asOwner } = await setup();
    const res = await integrations(asOwner).post({
      integrationKey: 'gitea',
      credential: { baseUrl: 'https://git.example.com', token: 'token-secret-abcd' },
    });
    expect(res.status).toBe(201);
    expect(res.data!.redacted).toMatchObject({
      baseUrl: 'https://git.example.com',
      token: '••••abcd',
    });
  });

  it('rejects an unknown integration', async () => {
    const { asOwner } = await setup();
    const res = await integrations(asOwner).post({
      integrationKey: 'not-an-integration',
      credential: {},
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing required field', async () => {
    const { asOwner } = await setup();
    const res = await integrations(asOwner).post({ integrationKey: 'jina', credential: {} });
    expect(res.status).toBe(400);
  });

  it('allows several credentials for the same integration', async () => {
    const { asOwner } = await setup();
    await integrations(asOwner).post({
      integrationKey: 'jina',
      label: 'A',
      credential: { apiKey: 'jina-a' },
    });
    const second = await integrations(asOwner).post({
      integrationKey: 'jina',
      label: 'B',
      credential: { apiKey: 'jina-b' },
    });
    expect(second.status).toBe(201);
    expect((await integrations(asOwner).get()).data).toHaveLength(2);
  });

  it('keeps the stored secret when an update omits it', async () => {
    const { asOwner } = await setup();
    const created = await integrations(asOwner).post({
      integrationKey: 'telegram',
      credential: { botToken: '123:secret-aaaa', defaultChatId: '42' },
    });
    const id = created.data!.id;
    const upd = await integrations(asOwner)({ credentialId: id }).patch({
      credential: { defaultChatId: '99' },
    });
    expect(upd.status).toBe(200);
    expect(upd.data!.redacted).toMatchObject({ botToken: '••••aaaa', defaultChatId: '99' });
  });

  it('deletes a credential', async () => {
    const { asOwner } = await setup();
    const created = await integrations(asOwner).post({
      integrationKey: 'openai',
      credential: { apiKey: 'sk-9999' },
    });
    const del = await integrations(asOwner)({ credentialId: created.data!.id }).delete();
    expect(del.status).toBe(204);
    expect((await integrations(asOwner).get()).data).toHaveLength(0);
  });

  // An agent's provider and model are picked over MCP, so the reads are tagged. The
  // writes are not: a credential body carries the provider's secret in plain text.
  // The options route is untagged too — it is what the UI pickers read, and the
  // credential list already covers the same ground for an agent.
  it('exposes the credential reads to MCP, not the writes', () => {
    const untagged = untaggedRoutes((route) => route.includes('integrations'));
    expect(untagged).toEqual([
      'GET /projects/:projectKey/integrations/options',
      'POST /projects/:projectKey/integrations',
      'PATCH /projects/:projectKey/integrations/:credentialId',
      'DELETE /projects/:projectKey/integrations/:credentialId',
    ]);
  });

  describe('options', () => {
    it('lists the connected integrations without any credential fields', async () => {
      const { asOwner } = await setup();
      await integrations(asOwner).post({
        integrationKey: 'openai',
        label: 'Team',
        credential: { apiKey: 'sk-secret-1234' },
      });
      await integrations(asOwner).post({
        integrationKey: 'jina',
        credential: { apiKey: 'jina-secret-1234' },
      });

      const res = await options(asOwner).get();
      expect(res.status).toBe(200);
      expect(res.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ integrationKey: 'openai', kind: 'llm', label: 'Team' }),
          expect.objectContaining({ integrationKey: 'jina', kind: 'tool', label: null }),
        ]),
      );
      expect(JSON.stringify(res.data)).not.toContain('••••');

      const llm = await options(asOwner).get({ query: { kind: 'llm' } });
      expect(llm.data!.map((o) => o.integrationKey)).toEqual(['openai']);
    });

    it('opens the options and the catalog to a member whose role has no integrations access', async () => {
      const { asOwner } = await setup();
      await integrations(asOwner).post({
        integrationKey: 'openai',
        credential: { apiKey: 'sk-secret-1234' },
      });
      const role = await asOwner
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Agents only', permissions: { ai_agents: { read: true } } });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

      expect((await options(asMember).get()).status).toBe(200);
      expect((await integrations(asMember).catalog.get()).status).toBe(200);
      // The credential list stays behind the integrations resource.
      expect((await integrations(asMember).get()).status).toBe(403);
    });

    it('denies a non-member', async () => {
      await setup();
      const asOutsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);
      expect((await options(asOutsider).get()).status).toBe(403);
    });
  });

  it('denies a non-member', async () => {
    await setup();
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);
    expect((await integrations(asOutsider).get()).status).toBe(403);
    expect(
      (
        await integrations(asOutsider).post({
          integrationKey: 'openai',
          credential: { apiKey: 'x' },
        })
      ).status,
    ).toBe(403);
  });
});
