import { beforeEach, describe, expect, it } from 'bun:test';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { createRole } from '#tests/helpers/roles';
import { routeTools } from '../../generate';

async function request(
  apiKey: string,
  method: string,
  params: Record<string, unknown> = {},
  query = '',
) {
  return app.handle(
    new Request(`http://localhost/mcp${query}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
}

async function rpc(
  apiKey: string,
  method: string,
  params: Record<string, unknown> = {},
  query = '',
) {
  const response = await request(apiKey, method, params, query);
  expect(response.status).toBe(200);
  const text = await response.text();
  return JSON.parse(text.slice(text.indexOf('data: ') + 6));
}

async function call(apiKey: string, name: string, args: Record<string, unknown> = {}) {
  const response = await rpc(apiKey, 'tools/call', { name, arguments: args });
  const result = CallToolResultSchema.parse(response.result);
  const content = result.content[0];
  if (content.type !== 'text') throw new Error('Expected a text tool result.');
  return { ...result, text: content.text };
}

async function keyFor(userId: string) {
  return (await auth.api.createApiKey({ body: { userId, name: 'discovery-test' } })).key;
}

async function setup() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const created = await api.projects.post({ key: 'MKT', name: 'Marketing' });
  expect(created.status).toBe(201);
  const project = {
    ...created.data!,
    ...(await api.projects({ projectKey: 'MKT' }).get()).data!,
  };
  return { user, api, project, apiKey: await keyFor(user.userId) };
}

describe('MCP progressive discovery', () => {
  beforeEach(resetDb);

  it('advertises a compact default catalog and every tool through the full endpoint', async () => {
    const { apiKey } = await setup();
    const compact = ListToolsResultSchema.parse((await rpc(apiKey, 'tools/list')).result);
    expect(compact.tools.map((tool) => tool.name).sort()).toEqual([
      'call_read_tool',
      'call_tool',
      'discover_tools',
      'get_document',
      'get_issue',
      'get_issue_by_number',
      'get_project',
      'list_issues',
      'list_projects',
      'list_teams',
      'search_workspace',
      'view_attachment',
      'view_initiative_images',
      'view_issue_images',
    ]);
    const images = routeTools(app).filter((tool) => tool.images);
    expect(
      compact.tools.every((tool) =>
        images.some((image) => image.name === tool.name)
          ? tool.outputSchema === undefined
          : tool.outputSchema?.type === 'object',
      ),
    ).toBe(true);
    const full = ListToolsResultSchema.parse(
      (await rpc(apiKey, 'tools/list', {}, '?catalog=full')).result,
    ).tools;
    expect(full.length).toBe(routeTools(app).length + 3);
    expect(new Set(full.map((tool) => tool.name)).size).toBe(full.length);
    expect(full.map((tool) => tool.name)).toContain('create_issue');
    expect(JSON.stringify(compact.tools).length).toBeLessThan(JSON.stringify(full).length / 3);
  });

  it('refuses an unknown catalog mode', async () => {
    const { apiKey } = await setup();
    expect((await request(apiKey, 'tools/list', {}, '?catalog=invalid')).status).toBe(400);
  });

  it('discovers exact tool schemas with output contracts, permissions, and resolved team arguments', async () => {
    const { apiKey } = await setup();
    const agent = await call(apiKey, 'discover_tools', { query: 'create_ai_agent', limit: 1 });
    expect(agent.isError).toBe(false);
    const tool = JSON.parse(agent.text).tools[0];
    expect(tool).toMatchObject({
      name: 'create_ai_agent',
      invokeWith: 'call_tool',
      outputSchema: { type: 'object' },
    });
    expect(tool.inputSchema.properties).not.toHaveProperty('teamId');
    expect(tool.inputSchema.required).not.toContain('teamId');

    const issue = await call(apiKey, 'discover_tools', { query: 'create_issue', limit: 1 });
    expect(JSON.parse(issue.text).tools[0]).toMatchObject({
      name: 'create_issue',
      permission: ['work_items', 'create'],
      inputSchema: { required: expect.arrayContaining(['projectKey', 'columnId', 'title']) },
    });
    const document = await call(apiKey, 'discover_tools', { query: 'get_document', limit: 1 });
    expect(JSON.parse(document.text).tools[0]).toMatchObject({
      name: 'get_document',
      invokeWith: 'call_read_tool',
      inputSchema: { properties: { includeContentJson: { type: 'boolean', default: false } } },
      outputSchema: { type: 'object' },
    });
  });

  it('lists the image tools and refuses them through the generic executors', async () => {
    const { apiKey } = await setup();
    const found = await call(apiKey, 'discover_tools', { query: 'view_issue_images', limit: 1 });
    expect(JSON.parse(found.text).tools[0]).toMatchObject({
      name: 'view_issue_images',
      invokeWith: 'view_issue_images',
    });
    for (const executor of ['call_read_tool', 'call_tool']) {
      const refused = await call(apiKey, executor, {
        name: 'view_issue_images',
        arguments: { issueId: 1 },
      });
      expect(refused.structuredContent).toMatchObject({ ok: false, status: 400 });
      expect(refused.text).toContain('view_issue_images');
    }
  });

  it('finds tools from task and board terms and bounds the discovery response', async () => {
    const { apiKey } = await setup();
    for (const [query, expected] of [
      ['create tasks', 'create_issue'],
      ['find boards', 'list_projects'],
      ['read docs', 'get_document'],
    ]) {
      const result = await call(apiKey, 'discover_tools', { query });
      expect(result.isError).toBe(false);
      const found = JSON.parse(result.text);
      expect(found.tools.length).toBeLessThanOrEqual(5);
      expect(found.tools.map((tool: { name: string }) => tool.name)).toContain(expected);
    }
    for (const args of [
      { query: '' },
      { query: 'issue', limit: 11 },
      { query: 'issue', offset: -1 },
    ]) {
      expect((await call(apiKey, 'discover_tools', args)).isError).toBe(true);
    }
  });

  it('runs discovered reads and mutations while preserving direct named calls', async () => {
    const { api, apiKey, project } = await setup();
    const created = await call(apiKey, 'call_tool', {
      name: 'create_issue',
      arguments: { projectKey: 'MKT', columnId: project.columns[0].id, title: 'Agent task' },
    });
    expect(created.isError).toBe(false);
    expect(created.structuredContent).toMatchObject({ ok: true, status: 201 });
    const issue = JSON.parse(created.text);
    const read = await call(apiKey, 'call_read_tool', {
      name: 'get_issue',
      arguments: { issueId: issue.id },
    });
    expect(read.isError).toBe(false);
    expect(JSON.parse(read.text)).toMatchObject({ id: issue.id, title: 'Agent task' });
    const direct = await call(apiKey, 'get_issue', { issueId: issue.id });
    expect(JSON.parse(direct.text)).toEqual(JSON.parse(read.text));
    expect((await api.issues({ issueId: issue.id }).get()).data?.title).toBe('Agent task');
  });

  it('refuses mutation through the read executor before changing data', async () => {
    const { api, apiKey, project } = await setup();
    const rejected = await call(apiKey, 'call_read_tool', {
      name: 'create_issue',
      arguments: { projectKey: 'MKT', columnId: project.columns[0].id, title: 'Refused task' },
    });
    expect(rejected.isError).toBe(true);
    expect(rejected.structuredContent).toMatchObject({ ok: false, status: 400 });
    expect(rejected.text).toContain('call_tool');
    expect((await api.projects({ projectKey: 'MKT' }).issues.get({ query: {} })).data).toEqual([]);
  });

  it('keeps project membership and role permissions on generic calls', async () => {
    const { api, apiKey, project } = await setup();
    const outsider = await signUpTestUser();
    const outsiderKey = await keyFor(outsider.userId);
    const denied = await call(outsiderKey, 'call_read_tool', {
      name: 'get_project',
      arguments: { projectKey: 'MKT' },
    });
    expect(denied.structuredContent).toMatchObject({ ok: false, status: 403 });

    const role = await createRole(api, 'MKT', {
      name: 'Reader',
      permissions: { work_items: { read: true, create: false } },
    });
    const invite = await api.projects({ projectKey: 'MKT' }).invites.post({
      email: outsider.email,
      role: 'member',
      roleId: role.data!.id,
    });
    expect(
      (await authedApi(outsider.cookie).invites({ token: invite.data!.token }).accept.post())
        .status,
    ).toBe(200);
    const created = await call(apiKey, 'call_tool', {
      name: 'create_issue',
      arguments: { projectKey: 'MKT', columnId: project.columns[0].id, title: 'Owner task' },
    });
    expect(created.isError).toBe(false);
    const forbidden = await call(outsiderKey, 'call_tool', {
      name: 'create_issue',
      arguments: { projectKey: 'MKT', columnId: project.columns[0].id, title: 'Refused task' },
    });
    expect(forbidden.structuredContent).toMatchObject({ ok: false, status: 403 });
    const read = await call(outsiderKey, 'call_read_tool', {
      name: 'get_issue',
      arguments: { issueId: JSON.parse(created.text).id },
    });
    expect(read.isError).toBe(false);
  });

  it('keeps project and team MCP switches on generic calls', async () => {
    const { api, apiKey, project } = await setup();
    const team = api.teams({ teamId: project.teamId });
    expect(
      (await team.mcp.patch({ projects: [{ projectId: project.id, enabled: false }] })).status,
    ).toBe(200);
    const denied = await call(apiKey, 'call_tool', {
      name: 'create_issue',
      arguments: { projectKey: 'MKT', columnId: project.columns[0].id, title: 'Refused task' },
    });
    expect(denied.structuredContent).toMatchObject({ ok: false, status: 403 });
    expect(denied.text).toContain('MCP is disabled for this project');
    await team.mcp.patch({ projects: [{ projectId: project.id, enabled: true }], enabled: false });
    const disabledTeam = await call(apiKey, 'call_read_tool', {
      name: 'list_ai_agents',
      arguments: { teamId: project.teamId },
    });
    expect(disabledTeam.structuredContent).toMatchObject({ ok: false, status: 403 });
    expect(disabledTeam.text).toContain('MCP is disabled for this team');
    expect((await api.projects({ projectKey: 'MKT' }).get()).status).toBe(200);
  });

  it('rejects missing and invalid path arguments instead of dispatching to a list route', async () => {
    const { apiKey } = await setup();
    for (const projectKey of [undefined, null, '', ' ', '.', '..', false, {}, []]) {
      const args = projectKey === undefined ? {} : { projectKey };
      for (const [name, arguments_] of [
        ['get_project', args],
        ['call_read_tool', { name: 'get_project', arguments: args }],
      ] as const) {
        const result = await call(apiKey, name, arguments_);
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toMatchObject({ ok: false, status: 400 });
        expect(result.text).toContain('projectKey');
      }
    }
    const invalidId = await call(apiKey, 'call_read_tool', {
      name: 'get_issue',
      arguments: { issueId: 'invalid' },
    });
    expect(invalidId.structuredContent).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects malformed invocation arguments, unknown names, and recursive executors', async () => {
    const { apiKey } = await setup();
    for (const args of [
      {},
      { name: 'list_projects' },
      { name: 'list_projects', arguments: null },
      { name: 'list_projects', arguments: [] },
      { name: 'list_projects', arguments: '{}' },
    ]) {
      const invalid = await call(apiKey, 'call_tool', args);
      expect(invalid.structuredContent).toMatchObject({ ok: false, status: 400 });
    }
    for (const name of ['missing_tool', 'call_tool', 'call_read_tool', 'discover_tools']) {
      const unknown = await call(apiKey, 'call_tool', { name, arguments: {} });
      expect(unknown.structuredContent).toMatchObject({ ok: false, status: 404 });
    }
    const invalidBody = await call(apiKey, 'call_tool', {
      name: 'create_issue',
      arguments: { projectKey: 'MKT', title: 'Missing column' },
    });
    expect(invalidBody.structuredContent).toMatchObject({ ok: false, status: 400 });
  });
});
