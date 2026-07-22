import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

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
