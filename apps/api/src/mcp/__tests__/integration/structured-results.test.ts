import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { buildMcpServer } from '../../server';

const clients: Client[] = [];

async function callTool(client: Client, params: CallToolRequest['params']) {
  return CallToolResultSchema.parse(await client.callTool(params));
}

async function connect(userId: string) {
  const { key } = await auth.api.createApiKey({ body: { userId, name: 'structured-results' } });
  const server = await buildMcpServer(app, { kind: 'api-key', apiKey: key }, userId);
  const client = new Client({ name: 'structured-results-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

describe('MCP structured results through the SDK client', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('compiles every advertised output schema and validates object, array, and empty results', async () => {
    const user = await signUpTestUser();
    const client = await connect(user.userId);
    const listed = await client.listTools();
    expect(listed.tools.length).toBeGreaterThan(0);
    expect(listed.tools.every((tool) => tool.outputSchema?.type === 'object')).toBe(true);

    const created = await callTool(client, {
      name: 'create_project',
      arguments: { key: 'RESULT', name: 'Structured results' },
    });
    expect(created.isError).toBe(false);
    expect(created.structuredContent).toMatchObject({
      ok: true,
      status: 201,
      data: { key: 'RESULT', name: 'Structured results' },
    });
    const text = created.content[0];
    expect(text.type).toBe('text');
    if (text.type === 'text')
      expect(JSON.parse(text.text)).toEqual(created.structuredContent?.data);

    const projects = await callTool(client, { name: 'list_projects' });
    expect(projects.structuredContent).toMatchObject({
      ok: true,
      status: 200,
      data: [{ key: 'RESULT' }],
    });

    const deleted = await callTool(client, {
      name: 'delete_project',
      arguments: { projectKey: 'RESULT' },
    });
    expect(deleted.isError).toBe(false);
    expect(deleted.content).toEqual([{ type: 'text', text: '' }]);
    expect(deleted.structuredContent).toEqual({ ok: true, status: 204, data: null });
  });

  it('validates structured validation, conflict, and permission errors without changing their text', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    await api.projects.post({ key: 'PRIVATE', name: 'Private project' });
    const client = await connect(owner.userId);
    await client.listTools();
    for (const [args, status] of [
      [{ key: 'MISSING' }, 400],
      [{ key: 'PRIVATE', name: 'Duplicate' }, 409],
    ] as const) {
      const result = await callTool(client, { name: 'create_project', arguments: args });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        ok: false,
        status,
        error: { code: `HTTP_${status}`, retryable: false, retryAfterSeconds: null },
      });
      const content = result.content[0];
      if (content.type === 'text') {
        expect(JSON.parse(content.text).error).toBe(
          (result.structuredContent?.error as { message: string }).message,
        );
      }
    }

    const outsider = await signUpTestUser();
    const otherClient = await connect(outsider.userId);
    await otherClient.listTools();
    const forbidden = await callTool(otherClient, {
      name: 'get_project',
      arguments: { projectKey: 'PRIVATE' },
    });
    expect(forbidden.isError).toBe(true);
    expect(forbidden.structuredContent).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'HTTP_403', retryable: false },
    });
  });

  it('returns the same error envelope for missing team arguments and unknown tools', async () => {
    const user = await signUpTestUser();
    await authedApi(user.cookie).teams.post({ name: 'Another team' });
    const client = await connect(user.userId);
    await client.listTools();
    const missing = await callTool(client, { name: 'list_ai_agents' });
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent).toMatchObject({
      ok: false,
      status: 400,
      error: { code: 'HTTP_400', retryable: false },
    });
    expect(missing.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('teamId'),
    });

    const unknown = await callTool(client, { name: 'unknown_tool' });
    expect(unknown.isError).toBe(true);
    expect(unknown.content).toEqual([{ type: 'text', text: 'Unknown tool: unknown_tool' }]);
    expect(unknown.structuredContent).toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'HTTP_404', retryable: false },
    });
  });
});
