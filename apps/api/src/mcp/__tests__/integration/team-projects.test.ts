import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { auth } from '@repo/auth';
import { app, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { routeTools, withoutFields } from '../../generate';
import { buildMcpServer } from '../../server';

const clients: Client[] = [];

async function connect(userId: string) {
  const { key } = await auth.api.createApiKey({ body: { userId, name: 'team-projects' } });
  const server = await buildMcpServer(app, { kind: 'api-key', apiKey: key }, userId);
  const client = new Client({ name: 'team-projects-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

async function callTool(client: Client, params: CallToolRequest['params']) {
  return CallToolResultSchema.parse(await client.callTool(params));
}

async function addTeamMember(api: Api, teamId: number, role: 'manager' | 'member') {
  const user = await signUpTestUser();
  const invite = await api.teams({ teamId }).invites.post({ email: user.email, role });
  const asMember = authedApi(user.cookie);
  expect((await asMember.invites({ token: invite.data!.token }).accept.post()).status).toBe(200);
  return { user, api: asMember };
}

describe('MCP team project route', () => {
  it('advertises the guarded team route with the existing project schemas', () => {
    const tools = routeTools(app);
    const tool = tools.find((tool) => tool.name === 'create_team_project');
    const generic = tools.find((tool) => tool.name === 'create_project')!;

    expect(tool).toBeDefined();
    expect(tool).toMatchObject({
      method: 'POST',
      path: '/teams/:teamId/projects',
      pathParams: ['teamId'],
      hasBody: true,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
    expect(tool!.inputSchema.required).toContain('teamId');
    expect(withoutFields(tool!.inputSchema, ['teamId'])).toEqual(generic.inputSchema);
    expect(tool!.outputSchema).toEqual(generic.outputSchema);
    expect(generic).toMatchObject({ method: 'POST', path: '/projects', pathParams: [] });
  });
});

describe('MCP team project creation', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('creates in the explicitly selected team and keeps generic creation in the first owned team', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const firstTeamId = (await api.teams.get()).data![0].id;
    const second = (await api.teams.post({ name: 'Second team', slug: 'second-team' })).data!;
    const client = await connect(owner.userId);
    const listed = await client.listTools();
    const tool = listed.tools.find((tool) => tool.name === 'create_team_project')!;
    expect(tool.inputSchema.required).toContain('teamId');

    const created = await callTool(client, {
      name: 'create_team_project',
      arguments: { teamId: second.id, key: 'TEAM', name: 'Team project', description: 'Details' },
    });
    expect(created.isError).toBe(false);
    expect(created.structuredContent).toMatchObject({
      ok: true,
      status: 201,
      data: { teamId: second.id, key: 'TEAM', name: 'Team project', description: 'Details' },
    });
    expect((await api.teams({ teamId: firstTeamId }).projects.get()).data?.items).toEqual([]);
    expect((await api.teams({ teamId: second.id }).projects.get()).data?.items).toMatchObject([
      { key: 'TEAM', isMember: true },
    ]);

    const generic = await callTool(client, {
      name: 'create_project',
      arguments: { key: 'GENERIC', name: 'Generic project' },
    });
    expect(generic.isError).toBe(false);
    expect(generic.structuredContent).toMatchObject({
      status: 201,
      data: { teamId: firstTeamId, key: 'GENERIC' },
    });
  });

  it('uses the existing key-derived team for a person with one MCP-enabled team', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const teamId = (await api.teams.get()).data![0].id;
    const client = await connect(owner.userId);
    const tool = (await client.listTools()).tools.find(
      (tool) => tool.name === 'create_team_project',
    )!;
    expect(tool.inputSchema.properties).not.toHaveProperty('teamId');
    expect(tool.inputSchema.required).not.toContain('teamId');

    const created = await callTool(client, {
      name: 'create_team_project',
      arguments: { key: 'ONE', name: 'One team' },
    });
    expect(created.isError).toBe(false);
    expect(created.structuredContent).toMatchObject({ status: 201, data: { teamId, key: 'ONE' } });
  });

  it('requires teamId when more than one team is available', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    await api.teams.post({ name: 'Second team', slug: 'second-team' });
    const result = await callTool(await connect(owner.userId), {
      name: 'create_team_project',
      arguments: { key: 'MISSING', name: 'Missing team' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 400 });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('teamId is required'),
    });
    expect((await api.projects.get()).data).toEqual([]);
  });

  it('lets a team manager create a project and become its owner', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const teamId = (await api.teams.get()).data![0].id;
    const manager = await addTeamMember(api, teamId, 'manager');
    const result = await callTool(await connect(manager.user.userId), {
      name: 'create_team_project',
      arguments: { teamId, key: 'MANAGED', name: 'Managed project', preset: 'software' },
    });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      status: 201,
      data: { teamId, key: 'MANAGED' },
    });
    expect((await manager.api.projects.get()).data).toMatchObject([
      { key: 'MANAGED', role: 'owner' },
    ]);
  });

  it('refuses a plain team member without creating a project', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const teamId = (await api.teams.get()).data![0].id;
    const member = await addTeamMember(api, teamId, 'member');
    const result = await callTool(await connect(member.user.userId), {
      name: 'create_team_project',
      arguments: { teamId, key: 'DENIED', name: 'Denied project' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 403 });
    expect((await api.teams({ teamId }).projects.get()).data?.items).toEqual([]);
  });

  it('hides another team from a caller who is not a member', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const privateTeamId = (await api.teams.get()).data![0].id;
    const visible = (await api.teams.post({ name: 'Visible', slug: 'visible' })).data!;
    const outsider = await addTeamMember(api, visible.id, 'member');
    const result = await callTool(await connect(outsider.user.userId), {
      name: 'create_team_project',
      arguments: { teamId: privateTeamId, key: 'PRIVATE', name: 'Private project' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 404 });
    expect((await api.teams({ teamId: privateTeamId }).projects.get()).data?.items).toEqual([]);
  });

  it('refuses an agent key even when the caller names another team', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const project = (await api.projects.post({ key: 'SOURCE', name: 'Source project' })).data!;
    const other = (await api.teams.post({ name: 'Other', slug: 'other' })).data!;
    const agent = (
      await createAgent(api, 'SOURCE', {
        name: 'Agent',
        username: 'project-agent',
        kind: 'external',
      })
    ).data!;
    const result = await callTool(await connect(agent.agent.userId), {
      name: 'create_team_project',
      arguments: { teamId: other.id, key: 'AGENT', name: 'Agent project' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 403 });
    expect((await api.teams({ teamId: other.id }).projects.get()).data?.items).toEqual([]);
    expect((await api.teams({ teamId: project.teamId }).projects.get()).data?.items).toMatchObject([
      { key: 'SOURCE' },
    ]);
  });

  it('refuses a team with MCP disabled while its HTTP route remains available', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    await api.teams.post({ name: 'Second', slug: 'second' });
    const disabled = (await api.teams.post({ name: 'Disabled', slug: 'disabled' })).data!;
    await api.teams({ teamId: disabled.id }).mcp.patch({ enabled: false });
    const result = await callTool(await connect(owner.userId), {
      name: 'create_team_project',
      arguments: { teamId: disabled.id, key: 'BLOCKED', name: 'Blocked project' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 403 });
    expect((await api.teams({ teamId: disabled.id }).projects.get()).data?.items).toEqual([]);
    expect(
      (
        await api
          .teams({ teamId: disabled.id })
          .projects.post({ key: 'HTTP', name: 'HTTP project' })
      ).status,
    ).toBe(201);
  });

  it('validates team and project fields without creating a project', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const target = (await api.teams.post({ name: 'Target', slug: 'target' })).data!;
    const client = await connect(owner.userId);
    for (const fields of [
      { teamId: 'invalid' },
      { key: '' },
      { key: 'lowercase' },
      { key: '1KEY' },
      { key: 'TOOLONGKEYXX' },
      { name: '' },
      { name: undefined },
      { description: 'x'.repeat(2001) },
      { preset: 'invalid' },
    ]) {
      const result = await callTool(client, {
        name: 'create_team_project',
        arguments: { teamId: target.id, key: 'VALID', name: 'Valid project', ...fields },
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ ok: false, status: 400 });
    }
    expect((await api.teams({ teamId: target.id }).projects.get()).data?.items).toEqual([]);
  });

  it('accepts the project key and description length boundaries', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const teamId = (await api.teams.get()).data![0].id;
    const description = 'x'.repeat(2000);
    const result = await callTool(await connect(owner.userId), {
      name: 'create_team_project',
      arguments: { key: 'A123456789', name: 'Boundary project', description },
    });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      status: 201,
      data: { teamId, key: 'A123456789', name: 'Boundary project', description },
    });
  });

  it('returns 404 for an unknown team', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    await api.teams.post({ name: 'Second', slug: 'second' });
    const result = await callTool(await connect(owner.userId), {
      name: 'create_team_project',
      arguments: { teamId: 999999, key: 'UNKNOWN', name: 'Unknown team' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 404 });
    expect((await api.projects.get()).data).toEqual([]);
  });

  it('rejects duplicate keys within the selected team and accepts the same key in another team', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const firstTeamId = (await api.teams.get()).data![0].id;
    const second = (await api.teams.post({ name: 'Second', slug: 'second' })).data!;
    const client = await connect(owner.userId);
    for (const teamId of [firstTeamId, second.id]) {
      const result = await callTool(client, {
        name: 'create_team_project',
        arguments: { teamId, key: 'SHARED', name: 'Shared key' },
      });
      expect(result.isError).toBe(false);
      expect(result.structuredContent).toMatchObject({
        status: 201,
        data: { teamId, key: 'SHARED' },
      });
    }
    const duplicate = await callTool(client, {
      name: 'create_team_project',
      arguments: { teamId: second.id, key: 'SHARED', name: 'Duplicate' },
    });
    expect(duplicate.isError).toBe(true);
    expect(duplicate.structuredContent).toMatchObject({ ok: false, status: 409 });
    expect((await api.teams({ teamId: second.id }).projects.get()).data?.items).toHaveLength(1);
  });
});
