import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { untaggedRoutes } from '#tests/helpers/mcp';
import { createRole } from '#tests/helpers/roles';

// Integration credentials for a team: one store for LLM provider keys (kind 'llm')
// and tool credentials (kind 'tool'), shared by every project the team owns. The
// secret is stored encrypted and never returned — a response carries only a redacted
// view. Access is the integrations permission resource, resolved on the team; the
// catalog and the picker options open to any member of it.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

const integrations = (api: Api, teamId: number) => api.teams({ teamId }).integrations;
const options = (api: Api, teamId: number) => integrations(api, teamId).options;

describe('integrations', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists the catalog with LLM providers and tool integrations', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).catalog.get();
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
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'openai',
      label: 'Team',
      credential: { apiKey: 'sk-secret-1234' },
    });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ teamId, integrationKey: 'openai', label: 'Team' });
    expect(res.data!.redacted).toMatchObject({ apiKey: '••••1234' });
    expect(JSON.stringify(res.data)).not.toContain('sk-secret-1234');

    const list = await integrations(asOwner, teamId).get();
    expect(list.data?.items).toHaveLength(1);
    expect(JSON.stringify(list.data)).not.toContain('sk-secret');
  });

  it('stores a tool credential (Jina)', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'jina',
      credential: { apiKey: 'jina-abcd' },
    });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ integrationKey: 'jina' });
  });

  it('stores a Gitea credential, showing the URL and masking the token', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'gitea',
      credential: { baseUrl: 'https://git.example.com', token: 'token-secret-abcd' },
    });
    expect(res.status).toBe(201);
    expect(res.data!.redacted).toMatchObject({
      baseUrl: 'https://git.example.com',
      token: '••••abcd',
    });
  });

  // A url field is where the secret is sent, so it is held to the SSRF rules when it
  // is stored: https only, no private or local host, no userinfo. The rules are the
  // strict ones under NODE_ENV=test.
  it('rejects a credential whose url field is not a public https origin', async () => {
    const { asOwner, teamId } = await setup();
    const rejected = [
      'http://git.example.com',
      'https://127.0.0.1',
      'https://localhost:3000',
      'https://169.254.169.254/latest/meta-data/',
      'https://user:pw@git.example.com',
      'https://git.example.com/?x=1',
      'not a url',
    ];
    for (const baseUrl of rejected) {
      const res = await integrations(asOwner, teamId).post({
        integrationKey: 'gitea',
        credential: { baseUrl, token: 'token-secret-abcd' },
      });
      expect(res.status).toBe(400);
      expect(res.error?.value).toMatchObject({ error: expect.stringContaining('Instance URL') });
    }
    expect((await integrations(asOwner, teamId).get()).data?.total).toBe(0);
  });

  it('rejects a model credential whose base URL is not a public https endpoint', async () => {
    const { asOwner, teamId } = await setup();
    for (const baseUrl of ['http://llm.example.com/v1', 'https://10.0.0.5/v1']) {
      const res = await integrations(asOwner, teamId).post({
        integrationKey: 'openai-compatible',
        credential: { apiKey: 'sk-secret-1234', baseUrl },
      });
      expect(res.status).toBe(400);
    }
    const ok = await integrations(asOwner, teamId).post({
      integrationKey: 'openai-compatible',
      credential: { apiKey: 'sk-secret-1234', baseUrl: 'https://llm.example.com/v1/' },
    });
    expect(ok.status).toBe(201);
    expect(ok.data!.redacted).toMatchObject({ baseUrl: 'https://llm.example.com/v1' });
  });

  it('requires the secret again when the url it is sent to changes', async () => {
    const { asOwner, teamId } = await setup();
    const created = await integrations(asOwner, teamId).post({
      integrationKey: 'gitea',
      credential: { baseUrl: 'https://git.example.com', token: 'token-secret-abcd' },
    });
    const id = created.data!.id;
    const route = integrations(asOwner, teamId)({ credentialId: id });

    const moved = await route.patch({ credential: { baseUrl: 'https://git.example.org' } });
    expect(moved.status).toBe(400);
    expect(moved.error?.value).toMatchObject({
      error: 'Changing Instance URL requires entering Access token again',
    });
    expect((await integrations(asOwner, teamId).get()).data?.items[0]?.redacted).toMatchObject({
      baseUrl: 'https://git.example.com',
    });

    // The same url resent by the edit form is not a change.
    const same = await route.patch({ credential: { baseUrl: 'https://git.example.com/' } });
    expect(same.status).toBe(200);
    expect(same.data!.redacted).toMatchObject({ token: '••••abcd' });

    const withToken = await route.patch({
      credential: { baseUrl: 'https://git.example.org', token: 'token-secret-wxyz' },
    });
    expect(withToken.status).toBe(200);
    expect(withToken.data!.redacted).toMatchObject({
      baseUrl: 'https://git.example.org',
      token: '••••wxyz',
    });
  });

  it('rejects an unknown integration', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'not-an-integration',
      credential: {},
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing required field', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'jina',
      credential: {},
    });
    expect(res.status).toBe(400);
  });

  it('allows several credentials for the same integration', async () => {
    const { asOwner, teamId } = await setup();
    await integrations(asOwner, teamId).post({
      integrationKey: 'jina',
      label: 'A',
      credential: { apiKey: 'jina-a' },
    });
    const second = await integrations(asOwner, teamId).post({
      integrationKey: 'jina',
      label: 'B',
      credential: { apiKey: 'jina-b' },
    });
    expect(second.status).toBe(201);
    expect((await integrations(asOwner, teamId).get()).data?.items).toHaveLength(2);
  });

  it('pages the credential list', async () => {
    const { asOwner, teamId } = await setup();
    for (const label of ['A', 'B', 'C']) {
      await integrations(asOwner, teamId).post({
        integrationKey: 'jina',
        label,
        credential: { apiKey: `jina-${label}` },
      });
    }

    const first = await integrations(asOwner, teamId).get({ query: { page: 1, pageSize: 2 } });
    expect(first.data).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.data?.items).toHaveLength(2);

    const second = await integrations(asOwner, teamId).get({ query: { page: 2, pageSize: 2 } });
    expect(second.data?.items).toHaveLength(1);

    // No window asked for: the default page, not the whole list.
    expect((await integrations(asOwner, teamId).get()).data).toMatchObject({
      page: 1,
      pageSize: 25,
      total: 3,
    });
  });

  it('keeps the stored secret when an update omits it', async () => {
    const { asOwner, teamId } = await setup();
    const created = await integrations(asOwner, teamId).post({
      integrationKey: 'telegram',
      credential: { botToken: '123:secret-aaaa', defaultChatId: '42' },
    });
    const id = created.data!.id;
    const upd = await integrations(
      asOwner,
      teamId,
    )({ credentialId: id }).patch({
      credential: { defaultChatId: '99' },
    });
    expect(upd.status).toBe(200);
    expect(upd.data!.redacted).toMatchObject({ botToken: '••••aaaa', defaultChatId: '99' });
  });

  it('deletes a credential', async () => {
    const { asOwner, teamId } = await setup();
    const created = await integrations(asOwner, teamId).post({
      integrationKey: 'openai',
      credential: { apiKey: 'sk-9999' },
    });
    const del = await integrations(asOwner, teamId)({ credentialId: created.data!.id }).delete();
    expect(del.status).toBe(204);
    expect((await integrations(asOwner, teamId).get()).data?.items).toHaveLength(0);
  });

  // An agent's provider and model are picked over MCP, so the reads are tagged. The
  // writes are not: a credential body carries the provider's secret in plain text. The
  // options route is untagged too: it is what the UI pickers read, and the credential
  // list already covers the same ground for an agent.
  it('exposes the credential reads to MCP, not the writes', () => {
    const untagged = untaggedRoutes((route) => route.includes('integrations'));
    expect(untagged).toEqual([
      'GET /teams/:teamId/integrations/options',
      'POST /teams/:teamId/integrations',
      'PATCH /teams/:teamId/integrations/:credentialId',
      'DELETE /teams/:teamId/integrations/:credentialId',
    ]);
  });

  describe('access', () => {
    it('lets a team member manage the credentials when their project role grants it', async () => {
      const { asOwner, teamId } = await setup();
      const role = await createRole(asOwner, 'MKT', {
        name: 'Integrator',
        permissions: { integrations: { create: true, read: true, edit: true, delete: true } },
      });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

      const created = await integrations(asMember, teamId).post({
        integrationKey: 'openai',
        credential: { apiKey: 'sk-1111' },
      });
      expect(created.status).toBe(201);
      expect((await integrations(asMember, teamId).get()).status).toBe(200);
      expect(
        (await integrations(asMember, teamId)({ credentialId: created.data!.id }).delete()).status,
      ).toBe(204);
    });

    // The default member role grants no integrations access, so passing here is the
    // project ownership and nothing else.
    it("lets the owner of one of the team's projects manage the credentials", async () => {
      const { asOwner, teamId } = await setup();
      const other = await signUpTestUser({ name: 'Project owner' });
      const asProjectOwner = authedApi(other.cookie);
      const invite = await asOwner
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: other.email, role: 'member' });
      await asProjectOwner.invites({ token: invite.data!.token }).accept.post();

      await asOwner.teams({ teamId }).projects.post({ key: 'SUP', name: 'Support' });
      await asOwner
        .projects({ projectKey: 'SUP' })
        .members.post({ userId: other.userId, role: 'owner' });

      const created = await integrations(asProjectOwner, teamId).post({
        integrationKey: 'openai',
        credential: { apiKey: 'sk-2222' },
      });
      expect(created.status).toBe(201);
      expect((await integrations(asProjectOwner, teamId).get()).status).toBe(200);
    });

    it('denies a team member whose project role has no integrations access', async () => {
      const { asOwner, teamId } = await setup();
      const role = await createRole(asOwner, 'MKT', {
        name: 'Agents only',
        permissions: { ai_agents: { read: true } },
      });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

      expect((await integrations(asMember, teamId).get()).status).toBe(403);
      expect(
        (
          await integrations(asMember, teamId).post({
            integrationKey: 'openai',
            credential: { apiKey: 'sk-1111' },
          })
        ).status,
      ).toBe(403);
      // The catalog holds no team data, so it stays open to any member of the team.
      expect((await integrations(asMember, teamId).catalog.get()).status).toBe(200);
    });

    it('hides the team from someone who does not belong to it', async () => {
      const { teamId } = await setup();
      const asOutsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);
      expect((await integrations(asOutsider, teamId).get()).status).toBe(404);
      expect(
        (
          await integrations(asOutsider, teamId).post({
            integrationKey: 'openai',
            credential: { apiKey: 'x' },
          })
        ).status,
      ).toBe(404);
    });
  });

  describe('options', () => {
    it('lists the connected integrations without any credential fields', async () => {
      const { asOwner, teamId } = await setup();
      await integrations(asOwner, teamId).post({
        integrationKey: 'openai',
        label: 'Team',
        credential: { apiKey: 'sk-secret-1234' },
      });
      await integrations(asOwner, teamId).post({
        integrationKey: 'jina',
        credential: { apiKey: 'jina-secret-1234' },
      });

      const res = await options(asOwner, teamId).get();
      expect(res.status).toBe(200);
      expect(res.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ integrationKey: 'openai', kind: 'llm', label: 'Team' }),
          expect.objectContaining({ integrationKey: 'jina', kind: 'tool', label: null }),
        ]),
      );
      expect(JSON.stringify(res.data)).not.toContain('••••');

      const llm = await options(asOwner, teamId).get({ query: { kind: 'llm' } });
      expect(llm.data!.map((o) => o.integrationKey)).toEqual(['openai']);
    });

    it('opens to a member whose role has no integrations access', async () => {
      const { asOwner, teamId } = await setup();
      await integrations(asOwner, teamId).post({
        integrationKey: 'openai',
        credential: { apiKey: 'sk-secret-1234' },
      });
      const role = await createRole(asOwner, 'MKT', {
        name: 'Agents only',
        permissions: { ai_agents: { read: true } },
      });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

      expect((await options(asMember, teamId).get()).status).toBe(200);
    });

    it('hides the options from someone who does not belong to the team', async () => {
      const { teamId } = await setup();
      const asOutsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);
      expect((await options(asOutsider, teamId).get()).status).toBe(404);
    });
  });
});
