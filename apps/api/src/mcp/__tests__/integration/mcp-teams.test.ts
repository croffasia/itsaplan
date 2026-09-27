import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { createAgent, setAgentProjectRole, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { getAgentById, getInternalAgentApiKey } from '#modules/agents/core/service';

// Agent management is a team operation, but an MCP client knows only projects. The
// team is resolved from the key instead of asked for; this covers who gets to name
// one and who must not.

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
  // The transport answers over SSE: one `data:` line carrying the JSON-RPC response.
  const text = await res.text();
  return JSON.parse(text.slice(text.indexOf('data: ') + 6)).result;
}

async function toolNamed(apiKey: string, name: string) {
  const { tools } = await rpc(apiKey, 'tools/list');
  return tools.find((tool: { name: string }) => tool.name === name);
}

async function call(apiKey: string, name: string, args: Record<string, unknown> = {}) {
  const result = await rpc(apiKey, 'tools/call', { name, arguments: args });
  return { text: result.content[0].text as string, isError: result.isError === true };
}

// A user, their first team, and the key of an internal agent living in it. The agent
// works in MKT on a role that may manage agents, which is what these tools need.
async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const teamId = await teamOf(asOwner, 'MKT');
  const role = await createRole(asOwner, 'MKT', {
    name: 'Agent Admin',
    permissions: { ai_agents: { create: true, read: true, edit: true, delete: true } },
  });
  const roleId = role.data!.id;
  const created = await createAgent(asOwner, 'MKT', {
    name: 'Triage Bot',
    username: 'triage',
    kind: 'internal',
  });
  await setAgentProjectRole(asOwner, 'MKT', created.data!.agent.userId, roleId);
  const agent = await getAgentById(created.data!.agent.id, teamId);
  return { owner, asOwner, teamId, roleId, agentKey: await getInternalAgentApiKey(agent!) };
}

describe('MCP team resolution', () => {
  beforeEach(resetDb);

  it('takes the team of an agent key from its agent and does not ask for one', async () => {
    const { agentKey, teamId, roleId, asOwner } = await setup();

    expect(
      Object.keys((await toolNamed(agentKey, 'create_ai_agent')).inputSchema.properties),
    ).not.toContain('teamId');

    const { isError } = await call(agentKey, 'create_ai_agent', {
      name: 'Second Bot',
      username: 'second',
      kind: 'external',
      roleId,
    });
    expect(isError).toBe(false);

    const listed = await asOwner.teams({ teamId })['ai-agents'].get();
    expect(listed.data!.map((a) => a.username)).toContain('second');
  });

  it('keeps an agent key in its own team when it names another', async () => {
    const { agentKey, roleId } = await setup();
    const other = await signUpTestUser({ name: 'Other', email: 'other@example.com' });
    const asOther = authedApi(other.cookie);
    await asOther.projects.post({ key: 'OPS', name: 'Ops' });
    const otherTeam = await teamOf(asOther, 'OPS');

    await call(agentKey, 'create_ai_agent', {
      teamId: otherTeam,
      name: 'Intruder',
      username: 'intruder',
      kind: 'external',
      roleId,
    });

    const listed = await asOther.teams({ teamId: otherTeam })['ai-agents'].get();
    expect(listed.data!.map((a) => a.username)).not.toContain('intruder');
  });

  it('asks a person in more than one team to name the team', async () => {
    const { owner, asOwner, agentKey } = await setup();
    await asOwner.teams.post({ name: 'Second Team', slug: 'second-team' });
    const personKey = (await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } }))
      .key;

    expect(
      Object.keys((await toolNamed(personKey, 'list_ai_agents')).inputSchema.properties),
    ).toContain('teamId');

    const { text, isError } = await call(personKey, 'list_ai_agents');
    expect(isError).toBe(true);
    expect(text).toContain('teamId');

    // The agent's own key is unaffected: it belongs to one team either way.
    expect((await call(agentKey, 'list_ai_agents')).isError).toBe(false);
  });

  it('lists the teams of the caller', async () => {
    const { owner, asOwner } = await setup();
    await asOwner.teams.post({ name: 'Second Team', slug: 'second-team' });
    const personKey = (await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } }))
      .key;

    const { text } = await call(personKey, 'list_teams');
    expect(JSON.parse(text).map((team: { name: string }) => team.name)).toContain('Second Team');
  });
});
