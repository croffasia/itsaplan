import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setExtraIntegrations, type ToolConfig } from '@repo/agent-tools';
import { setCredentialChecker } from '#modules/agents/integrations/credential-check';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
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
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
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
        expect.objectContaining({
          key: 'github',
          tools: expect.arrayContaining([
            expect.objectContaining({ key: 'github_list_issues', group: 'Issues' }),
          ]),
        }),
      ]),
    );
  });

  it('carries the brand mark of a tool integration and the website of each', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).catalog.get();
    const telegram = res.data?.find((integration) => integration.key === 'telegram');
    const openai = res.data?.find((integration) => integration.key === 'openai');
    expect(telegram?.icon).toEqual({ path: expect.any(String), color: '#26A5E4' });
    expect(telegram?.website).toBe('https://telegram.org');
    expect(openai?.icon).toBeUndefined();
    expect(openai?.website).toBe('https://platform.openai.com/docs/models');
  });

  // The tool and integration pickers search the label, so a search for Forgejo finds the
  // Gitea tools that serve it.
  it('names Forgejo in the Gitea integration label', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).catalog.get();
    const gitea = res.data?.find((integration) => integration.key === 'gitea');
    expect(gitea?.label.toLowerCase()).toContain('forgejo');
  });

  it('lists a tool integration an extension adds after start', async () => {
    const { asOwner, teamId } = await setup();
    setExtraIntegrations([{ key: 'extra', label: 'Extra', credentialSchema: [], tools: [] }]);
    try {
      const res = await integrations(asOwner, teamId).catalog.get();
      expect(res.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'extra', kind: 'tool' })]),
      );
    } finally {
      setExtraIntegrations();
    }
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

  it('stores a GitHub credential, showing the URL and masking the token', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'github',
      credential: { baseUrl: 'https://github.example.com', token: 'github_pat_secret-abcd' },
    });
    expect(res.status).toBe(201);
    expect(res.data!.redacted).toMatchObject({
      baseUrl: 'https://github.example.com',
      token: '••••abcd',
    });
    expect(JSON.stringify(res.data)).not.toContain('github_pat_secret');
  });

  it('rejects an unknown integration', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({
      integrationKey: 'not-an-integration',
      credential: {},
    });
    expect(res.status).toBe(400);
  });

  it('refuses a credential for an integration that needs none', async () => {
    const { asOwner, teamId } = await setup();
    const res = await integrations(asOwner, teamId).post({ integrationKey: 'pdf', credential: {} });
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

  describe('list filters', () => {
    async function seed() {
      const ctx = await setup();
      const add = (integrationKey: string, label: string | null, credential: object) =>
        integrations(ctx.asOwner, ctx.teamId).post({ integrationKey, label, credential });
      await add('openai', 'Team', { apiKey: 'sk-1' });
      await add('jina', 'Reader', { apiKey: 'jina-1' });
      await add('firecrawl', null, { apiKey: 'fc-1' });
      return ctx;
    }
    const keys = (res: { data: { items: { integrationKey: string }[] } | null }) =>
      res.data?.items.map((c) => c.integrationKey).sort();

    it('searches the integration name, its key and the credential label', async () => {
      const { asOwner, teamId } = await seed();
      const list = integrations(asOwner, teamId);

      expect(keys(await list.get({ query: { search: 'OpenAI' } }))).toEqual(['openai']);
      expect(keys(await list.get({ query: { search: 'firecr' } }))).toEqual(['firecrawl']);
      expect(keys(await list.get({ query: { search: 'reader' } }))).toEqual(['jina']);
      const none = await list.get({ query: { search: 'zzz' } });
      expect(none.data).toMatchObject({ items: [], total: 0 });
    });

    it('lists everything for a blank search', async () => {
      const { asOwner, teamId } = await seed();
      const res = await integrations(asOwner, teamId).get({ query: { search: '   ' } });
      expect(res.data?.total).toBe(3);
    });

    it('treats a typed wildcard as a plain character', async () => {
      const { asOwner, teamId } = await seed();
      const res = await integrations(asOwner, teamId).get({ query: { search: '%' } });
      expect(res.data?.total).toBe(0);
    });

    it('narrows the list to the kinds asked for', async () => {
      const { asOwner, teamId } = await seed();
      const list = integrations(asOwner, teamId);

      expect(keys(await list.get({ query: { kind: 'llm' } }))).toEqual(['openai']);
      expect(keys(await list.get({ query: { kind: 'tool' } }))).toEqual(['firecrawl', 'jina']);
      expect(keys(await list.get({ query: { kind: 'llm,tool' } }))).toHaveLength(3);
    });

    it('rejects a kind the catalog does not carry', async () => {
      const { asOwner, teamId } = await seed();
      const list = integrations(asOwner, teamId);
      expect((await list.get({ query: { kind: 'other' } })).status).toBe(400);
      expect((await list.get({ query: { kind: 'llm,' } })).status).toBe(400);
    });

    it('combines the search with the kinds and counts the matches', async () => {
      const { asOwner, teamId } = await seed();
      const res = await integrations(asOwner, teamId).get({
        query: { search: 'team', kind: 'tool' },
      });
      expect(res.data).toMatchObject({ items: [], total: 0 });
    });

    it('takes a search of up to 200 characters', async () => {
      const { asOwner, teamId } = await seed();
      const list = integrations(asOwner, teamId);
      expect((await list.get({ query: { search: 'a'.repeat(200) } })).status).toBe(200);
      expect((await list.get({ query: { search: 'a'.repeat(201) } })).status).toBe(400);
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

  // The tools send the stored token to baseUrl, so an edit that kept the token under a
  // new address would hand it to whoever can edit but never read it.
  it('refuses a new address that keeps the stored token', async () => {
    const { asOwner, teamId } = await setup();
    const created = await integrations(asOwner, teamId).post({
      integrationKey: 'github',
      credential: { token: 'github_pat_secret-abcd' },
    });
    const role = await createRole(asOwner, 'MKT', {
      name: 'Integrator',
      permissions: { integrations: { read: true, edit: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    const upd = await integrations(
      asMember,
      teamId,
    )({ credentialId: created.data!.id }).patch({
      credential: { baseUrl: 'https://collector.example' },
    });
    expect(upd.status).toBe(400);
    const list = await integrations(asOwner, teamId).get();
    expect(list.data!.items[0]!.redacted).not.toHaveProperty('baseUrl');
  });

  it('takes a new address with the token, and the same address without it', async () => {
    const { asOwner, teamId } = await setup();
    const created = await integrations(asOwner, teamId).post({
      integrationKey: 'gitea',
      credential: { baseUrl: 'https://git.example.com', token: 'token-secret-abcd' },
    });
    const credential = integrations(asOwner, teamId)({ credentialId: created.data!.id });

    const same = await credential.patch({ credential: { baseUrl: 'https://git.example.com' } });
    expect(same.status).toBe(200);

    const moved = await credential.patch({
      credential: { baseUrl: 'https://git2.example.com', token: 'token-secret-efgh' },
    });
    expect(moved.status).toBe(200);
    expect(moved.data!.redacted).toMatchObject({
      baseUrl: 'https://git2.example.com',
      token: '••••efgh',
    });
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
      'POST /teams/:teamId/integrations/check',
      'POST /teams/:teamId/integrations/:credentialId/check',
      'PATCH /teams/:teamId/integrations/:credentialId',
      'DELETE /teams/:teamId/integrations/:credentialId',
    ]);
  });

  // The preload answers "unknown" to every check, so these tests install the answer they
  // need and put the preload's back.
  describe('credential check', () => {
    afterEach(() => setCredentialChecker(async () => 'unknown'));

    it('refuses a credential its service rejects and stores nothing', async () => {
      const { asOwner, teamId } = await setup();
      setCredentialChecker(async () => 'rejected');
      const res = await integrations(asOwner, teamId).post({
        integrationKey: 'openai',
        credential: { apiKey: 'sk-revoked-1234' },
      });
      expect(res.status).toBe(400);
      expect(res.error?.value).toMatchObject({
        error: 'OpenAI rejected this credential. Check it and try again.',
      });
      const list = await integrations(asOwner, teamId).get();
      expect(list.data?.items).toHaveLength(0);
    });

    it('checks the stored secret together with the change on an update', async () => {
      const { asOwner, teamId } = await setup();
      const created = await integrations(asOwner, teamId).post({
        integrationKey: 'telegram',
        credential: { botToken: '123:abc' },
      });
      const checked: ToolConfig[] = [];
      setCredentialChecker(async (_key, config) => {
        checked.push(config);
        return 'rejected';
      });
      const res = await integrations(
        asOwner,
        teamId,
      )({ credentialId: created.data!.id }).patch({ credential: { defaultChatId: '42' } });
      expect(res.status).toBe(400);
      expect(checked).toEqual([{ botToken: '123:abc', defaultChatId: '42' }]);
    });

    it('checks a new credential without storing it', async () => {
      const { asOwner, teamId } = await setup();
      setCredentialChecker(async () => 'valid');
      const res = await integrations(asOwner, teamId).check.post({
        integrationKey: 'jina',
        credential: { apiKey: 'jina-abcd' },
      });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ result: 'valid' });
      const list = await integrations(asOwner, teamId).get();
      expect(list.data?.items).toHaveLength(0);
    });

    it('refuses to check an integration it does not know', async () => {
      const { asOwner, teamId } = await setup();
      const res = await integrations(asOwner, teamId).check.post({
        integrationKey: 'not-an-integration',
        credential: {},
      });
      expect(res.status).toBe(400);
    });

    it('checks a stored credential with the changes over it, storing nothing', async () => {
      const { asOwner, teamId } = await setup();
      const created = await integrations(asOwner, teamId).post({
        integrationKey: 'telegram',
        credential: { botToken: '123:abc' },
      });
      const checked: ToolConfig[] = [];
      setCredentialChecker(async (_key, config) => {
        checked.push(config);
        return 'rejected';
      });
      const credential = integrations(asOwner, teamId)({ credentialId: created.data!.id });
      const res = await credential.check.post({ credential: { defaultChatId: '42' } });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ result: 'rejected' });
      expect(checked).toEqual([{ botToken: '123:abc', defaultChatId: '42' }]);
      const list = await integrations(asOwner, teamId).get();
      expect(list.data!.items[0]!.redacted).not.toHaveProperty('defaultChatId');
    });

    // The check would otherwise send the stored token to an address of the caller's choice.
    it('refuses to check a stored credential at a new address without its secret', async () => {
      const { asOwner, teamId } = await setup();
      const created = await integrations(asOwner, teamId).post({
        integrationKey: 'gitea',
        credential: { baseUrl: 'https://git.example.com', token: 'token-secret-abcd' },
      });
      const credential = integrations(asOwner, teamId)({ credentialId: created.data!.id });
      const res = await credential.check.post({
        credential: { baseUrl: 'https://collector.example' },
      });
      expect(res.status).toBe(400);
    });

    it('answers 404 for a credential the team does not hold', async () => {
      const { asOwner, teamId } = await setup();
      const res = await integrations(
        asOwner,
        teamId,
      )({ credentialId: 999_999 }).check.post({
        credential: {},
      });
      expect(res.status).toBe(404);
    });

    it('refuses the checks to a member who may only read the credentials', async () => {
      const { asOwner, teamId } = await setup();
      const created = await integrations(asOwner, teamId).post({
        integrationKey: 'jina',
        credential: { apiKey: 'jina-abcd' },
      });
      const role = await createRole(asOwner, 'MKT', {
        name: 'Reader',
        permissions: { integrations: { read: true } },
      });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);
      const fresh = await integrations(asMember, teamId).check.post({
        integrationKey: 'jina',
        credential: { apiKey: 'jina-efgh' },
      });
      expect(fresh.status).toBe(403);
      const stored = await integrations(
        asMember,
        teamId,
      )({
        credentialId: created.data!.id,
      }).check.post({ credential: {} });
      expect(stored.status).toBe(403);
    });

    it('renames a credential without asking its service', async () => {
      const { asOwner, teamId } = await setup();
      const created = await integrations(asOwner, teamId).post({
        integrationKey: 'jina',
        credential: { apiKey: 'jina-abcd' },
      });
      setCredentialChecker(async () => 'rejected');
      const res = await integrations(
        asOwner,
        teamId,
      )({ credentialId: created.data!.id }).patch({ label: 'Search' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ label: 'Search' });
    });
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
