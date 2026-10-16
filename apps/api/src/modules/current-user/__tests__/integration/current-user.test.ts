import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { createAgent, teamOf } from '#tests/helpers/agents';
import { mcpAccessToken } from '#tests/helpers/mcp';
import { getAgentById, getInternalAgentApiKey } from '#modules/agents/core/service';

// An MCP client acts as the person behind its key, and "my issues" needs to know who
// that is. Without a tool that says so, the model guessed from the client's own context
// and answered for someone else.

async function rpc(apiKey: string, method: string, params: Record<string, unknown> = {}) {
  const res = await app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  const text = await res.text();
  return JSON.parse(text.slice(text.indexOf('data: ') + 6)).result;
}

async function currentUser(apiKey: string) {
  const result = await rpc(apiKey, 'tools/call', { name: 'get_current_user', arguments: {} });
  return { data: JSON.parse(result.content[0].text), isError: result.isError === true };
}

describe('GET /me', () => {
  beforeEach(resetDb);

  it('keeps every field of the stored user and adds the zone and whether it is an agent', async () => {
    const person = await signUpTestUser({ name: 'Person', email: 'person.one@example.com' });
    const asPerson = authedApi(person.cookie);
    await asPerson.account.preferences.patch({ timezone: 'Europe/Madrid' });
    const session = await auth.api.getSession({ headers: new Headers({ cookie: person.cookie }) });

    const { data, status } = await asPerson.me.get();

    expect(status).toBe(200);
    // Treaty revives the iso() dates into Dates, so they compare with the session's own.
    expect(data as unknown).toEqual({
      authenticated: true,
      user: { ...session!.user, timezone: 'Europe/Madrid', isAgent: false },
    });
    expect(data).toMatchObject({ user: { id: person.userId, username: 'person.one' } });
  });

  it('tells an MCP client whose key it holds', async () => {
    const owner = await signUpTestUser({ name: 'Owner' });
    await signUpTestUser({ name: 'Someone Else' });
    const { key } = await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } });

    const { data, isError } = await currentUser(key);

    expect(isError).toBe(false);
    expect(data).toMatchObject({
      authenticated: true,
      user: { id: owner.userId, name: 'Owner', timezone: 'UTC', isAgent: false },
    });
  });

  it('tells a client signed in over OAuth who approved it', async () => {
    await signUpTestUser();
    const person = await signUpTestUser({ name: 'Person' });

    const { data, isError } = await currentUser(await mcpAccessToken(person.cookie));

    expect(isError).toBe(false);
    expect(data).toMatchObject({
      authenticated: true,
      user: { id: person.userId, name: 'Person', isAgent: false },
    });
  });

  it('tells an agent it is one, with its handle', async () => {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
    const teamId = await teamOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Triage Bot',
      username: 'triage',
      kind: 'internal',
    });
    const agent = await getAgentById(created.data!.agent.id, teamId);

    const { data } = await currentUser(await getInternalAgentApiKey(agent!));

    expect(data).toMatchObject({
      authenticated: true,
      user: { id: created.data!.agent.userId, username: 'triage', isAgent: true },
    });
  });

  it('points the model at it for "me" in the server instructions', async () => {
    const owner = await signUpTestUser();
    const { key } = await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } });

    const { instructions } = await rpc(key, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });

    expect(instructions).toContain('get_current_user');
  });
});
