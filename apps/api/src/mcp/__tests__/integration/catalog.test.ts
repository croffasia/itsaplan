import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { auth } from '@repo/auth';
import { app, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { routeTools } from '../../generate';
import { SERVER_INSTRUCTIONS } from '../../instructions';
import { PRIMARY_TOOLS } from '../../catalog';
import { buildMcpServer } from '../../server';

const CATALOG_TOOLS = ['discover', 'execute_read', 'execute_write', 'execute_destructive'];

const clients: Client[] = [];

async function connect(userId: string, catalog: boolean) {
  const { key } = await auth.api.createApiKey({ body: { userId, name: 'catalog' } });
  const server = await buildMcpServer(
    app,
    { kind: 'api-key', apiKey: key },
    userId,
    undefined,
    catalog,
  );
  const client = new Client({ name: 'catalog-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

async function callTool(client: Client, params: CallToolRequest['params']) {
  return CallToolResultSchema.parse(await client.callTool(params));
}

function textOf(result: Awaited<ReturnType<typeof callTool>>): string {
  const block = result.content[0];
  return block.type === 'text' ? block.text : '';
}

// One JSON-RPC call to /mcp with the given query string, as a client configured with
// that url sends it.
async function post(search: string, apiKey: string, method: string) {
  return app.handle(
    new Request(`http://localhost/mcp${search}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
    }),
  );
}

async function resultOf(res: Response) {
  const text = await res.text();
  return JSON.parse(text.slice(text.indexOf('data: ') + 6)).result;
}

describe('MCP catalog mode', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('leaves the default mode as it is', async () => {
    const user = await signUpTestUser();
    const client = await connect(user.userId, false);
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);

    const { tools } = await client.listTools();
    const table = routeTools(app);
    expect(tools.map((t) => t.name)).toEqual(table.map((t) => t.name));
    const route = table.find((t) => t.name === 'delete_label')!;
    expect<unknown>(tools.find((t) => t.name === 'delete_label')).toEqual({
      name: 'delete_label',
      description: route.description,
      inputSchema: route.inputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      outputSchema: route.outputSchema,
    });

    const called = await callTool(client, { name: 'discover', arguments: { query: 'label' } });
    expect(called.isError).toBe(true);
    expect(textOf(called)).toBe('Unknown tool: discover');
  });

  it('lists the catalog tools and the primary tools, without output schemas', async () => {
    const user = await signUpTestUser();
    const client = await connect(user.userId, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([...CATALOG_TOOLS, ...PRIMARY_TOOLS]);
    expect(tools.filter((t) => t.outputSchema !== undefined)).toEqual([]);

    const annotations = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    expect(annotations.discover).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(annotations.execute_read).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(annotations.execute_write).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(annotations.execute_destructive).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });

    const all = await (await connect(user.userId, false)).listTools();
    const full = all.tools.find((t) => t.name === 'create_issue')!;
    expect(tools.find((t) => t.name === 'create_issue')).toEqual({
      name: full.name,
      description: full.description,
      inputSchema: full.inputSchema,
      annotations: full.annotations,
    });

    const instructions = client.getInstructions()!;
    expect(instructions).toContain('discover');
    expect(instructions).toContain('execute_destructive');
    expect(instructions).toContain(SERVER_INSTRUCTIONS);
  });

  it('discovers a tool with the input schema the default mode lists for it', async () => {
    const user = await signUpTestUser();
    const client = await connect(user.userId, true);
    const all = await (await connect(user.userId, false)).listTools();

    const found = await callTool(client, {
      name: 'discover',
      arguments: { query: 'delete label' },
    });
    expect(found.isError).toBeFalsy();
    const data = found.structuredContent!.data as {
      total: number;
      tools: Record<string, unknown>[];
    };
    expect(JSON.parse(textOf(found))).toEqual(data);
    expect(data.tools.length).toBe(5);
    expect(data.total).toBeGreaterThan(5);
    expect(data.tools[0]).toEqual({
      name: 'delete_label',
      description: all.tools.find((t) => t.name === 'delete_label')!.description,
      execute: 'execute_destructive',
      annotations: all.tools.find((t) => t.name === 'delete_label')!.annotations,
      inputSchema: all.tools.find((t) => t.name === 'delete_label')!.inputSchema,
    });

    // A person with one team is not asked for it, in either mode.
    const exact = await callTool(client, {
      name: 'discover',
      arguments: { query: 'list_ai_agents' },
    });
    const only = (exact.structuredContent!.data as typeof data).tools;
    expect(only.map((t) => t.name)).toEqual(['list_ai_agents']);
    expect(only[0].inputSchema).toEqual(
      all.tools.find((t) => t.name === 'list_ai_agents')!.inputSchema,
    );
    expect(Object.keys((only[0].inputSchema as { properties: object }).properties)).not.toContain(
      'teamId',
    );

    const limited = await callTool(client, {
      name: 'discover',
      arguments: { query: 'issue', limit: 10 },
    });
    expect((limited.structuredContent!.data as typeof data).tools).toHaveLength(10);

    const none = await callTool(client, { name: 'discover', arguments: { query: 'zzzz' } });
    expect(none.structuredContent).toMatchObject({
      ok: true,
      status: 200,
      data: { total: 0, tools: [], unmatched: ['zzzz'], resources: { issue: expect.any(Number) } },
    });
    expect(JSON.parse(textOf(none))).toEqual(none.structuredContent!.data);
  });

  it('refuses discover arguments outside its schema', async () => {
    const user = await signUpTestUser();
    const client = await connect(user.userId, true);
    for (const args of [
      {},
      { query: ' ' },
      { query: 'issue', limit: 11 },
      { query: 'issue', limit: 0 },
    ]) {
      const result = await callTool(client, { name: 'discover', arguments: args });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ ok: false, status: 400 });
    }
  });

  it('runs a tool through the execute tool of its tier', async () => {
    const user = await signUpTestUser();
    const api = authedApi(user.cookie);
    const client = await connect(user.userId, true);

    const created = await callTool(client, {
      name: 'execute_write',
      arguments: { name: 'create_project', arguments: { key: 'CAT', name: 'Catalog' } },
    });
    expect(created.isError).toBe(false);
    expect(created.structuredContent).toMatchObject({
      ok: true,
      status: 201,
      data: { key: 'CAT', name: 'Catalog' },
    });
    expect(JSON.parse(textOf(created))).toEqual(created.structuredContent!.data);

    const read = await callTool(client, {
      name: 'execute_read',
      arguments: { name: 'list_members', arguments: { projectKey: 'CAT' } },
    });
    expect(read.structuredContent).toMatchObject({ ok: true, status: 200 });

    // The team follows from the key, as on a direct call.
    const agents = await callTool(client, {
      name: 'execute_read',
      arguments: { name: 'list_ai_agents' },
    });
    expect(agents.structuredContent).toMatchObject({ ok: true, status: 200 });

    const deleted = await callTool(client, {
      name: 'execute_destructive',
      arguments: { name: 'delete_project', arguments: { projectKey: 'CAT' } },
    });
    expect(deleted.structuredContent).toEqual({ ok: true, status: 204, data: null });
    expect((await api.projects({ projectKey: 'CAT' }).get()).status).toBe(404);
  });

  it('refuses a tool of another tier and names the execute tool to use', async () => {
    const user = await signUpTestUser();
    const api = authedApi(user.cookie);
    await createProject(api, { key: 'CAT', name: 'Catalog' });
    const client = await connect(user.userId, true);

    for (const [via, name, right] of [
      ['execute_read', 'delete_project', 'execute_destructive'],
      ['execute_write', 'delete_project', 'execute_destructive'],
      ['execute_read', 'update_project', 'execute_write'],
      ['execute_destructive', 'update_project', 'execute_write'],
      ['execute_write', 'get_project', 'execute_read'],
      ['execute_destructive', 'get_project', 'execute_read'],
    ]) {
      const result = await callTool(client, {
        name: via,
        arguments: { name, arguments: { projectKey: 'CAT', name: 'Renamed' } },
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ ok: false, status: 400 });
      expect(textOf(result)).toBe(`${name} is run with ${right}, not ${via}.`);
    }
    expect((await api.projects({ projectKey: 'CAT' }).get()).data!.project.name).toBe('Catalog');
  });

  it('refuses an unknown tool name and execute arguments outside the schema', async () => {
    const user = await signUpTestUser();
    const client = await connect(user.userId, true);

    const unknown = await callTool(client, {
      name: 'execute_read',
      arguments: { name: 'no_such_tool' },
    });
    expect(unknown.isError).toBe(true);
    expect(textOf(unknown)).toBe('Unknown tool: no_such_tool');
    expect(unknown.structuredContent).toMatchObject({ ok: false, status: 404 });

    for (const args of [
      {},
      { name: 'list_projects', arguments: 'all' },
      { name: 'get_project', projectKey: 'CAT' },
    ]) {
      const result = await callTool(client, { name: 'execute_read', arguments: args });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ ok: false, status: 400 });
    }
  });

  it('returns the route errors of an executed tool as a direct call does', async () => {
    const owner = await signUpTestUser();
    await createProject(authedApi(owner.cookie), { key: 'PRIVATE', name: 'Private project' });
    const outsider = await signUpTestUser();
    const args = { name: 'list_members', arguments: { projectKey: 'PRIVATE' } };

    const direct = await callTool(await connect(outsider.userId, false), args);
    const viaCatalog = await callTool(await connect(outsider.userId, true), {
      name: 'execute_read',
      arguments: args,
    });
    expect(direct.structuredContent).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'HTTP_403' },
    });
    expect(viaCatalog).toEqual(direct);

    const invalid = await callTool(await connect(owner.userId, true), {
      name: 'execute_write',
      arguments: { name: 'create_project', arguments: { key: 'MISSING' } },
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent).toMatchObject({ ok: false, status: 400 });
  });

  it('calls a primary tool directly and refuses a direct call of an unlisted one', async () => {
    const user = await signUpTestUser();
    const api = authedApi(user.cookie);
    await createProject(api, { key: 'CAT', name: 'Catalog' });
    const client = await connect(user.userId, true);

    const projects = await callTool(client, { name: 'list_projects' });
    expect(projects.structuredContent).toMatchObject({ ok: true, data: [{ key: 'CAT' }] });

    const direct = await callTool(client, {
      name: 'delete_project',
      arguments: { projectKey: 'CAT' },
    });
    expect(direct.isError).toBe(true);
    expect(textOf(direct)).toBe(
      'delete_project is not listed in catalog mode. Run it with execute_destructive.',
    );
    expect((await api.projects({ projectKey: 'CAT' }).get()).status).toBe(200);
  });

  it('selects the mode by the tools query parameter and refuses another value', async () => {
    const user = await signUpTestUser();
    const { key } = await auth.api.createApiKey({ body: { userId: user.userId, name: 'mode' } });

    const all = await resultOf(await post('', key, 'tools/list'));
    expect(all.tools).toHaveLength(routeTools(app).length);

    const catalog = await resultOf(await post('?tools=catalog', key, 'tools/list'));
    expect(catalog.tools.map((t: { name: string }) => t.name)).toEqual([
      ...CATALOG_TOOLS,
      ...PRIMARY_TOOLS,
    ]);

    for (const search of ['?tools=compact', '?tools=']) {
      const refused = await post(search, key, 'tools/list');
      expect(refused.status).toBe(400);
      expect(await refused.json()).toEqual({
        jsonrpc: '2.0',
        error: { code: -32602, message: 'Unknown value of "tools". Supported: catalog.' },
        id: null,
      });
    }
  });
});
