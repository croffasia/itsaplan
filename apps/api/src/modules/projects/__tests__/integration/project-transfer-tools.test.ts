import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { buildMcpServer } from '#mcp/server';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { routeTools } from '#mcp/generate';

describe('project transfer MCP tools', () => {
  it('advertises a read-only preview and guarded, retryable mutation', () => {
    const tools = routeTools(app);
    const preview = tools.find((t) => t.name === 'preview_project_transfer');
    const transfer = tools.find((t) => t.name === 'transfer_project');
    expect(preview).toMatchObject({ annotations: { readOnlyHint: true, destructiveHint: false } });
    expect(transfer).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    });
    expect(transfer?.inputSchema.required).toEqual(
      expect.arrayContaining(['projectKey', 'projectId', 'sourceTeamId', 'targetTeamId']),
    );
  });
});

const clients: Client[] = [];

async function connect(userId: string) {
  const { key } = await auth.api.createApiKey({ body: { userId, name: 'project-transfer-test' } });
  const server = await buildMcpServer(app, { kind: 'api-key', apiKey: key }, userId);
  const client = new Client({ name: 'project-transfer-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

describe('project transfers through MCP', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('lists and calls the preview and transfer tools, including retrying the old ref', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const source = (await api.projects.post({ key: 'MOVE', name: 'Project' })).data!;
    const target = (await api.teams.post({ name: 'Destination', slug: 'destination' })).data!;
    const client = await connect(owner.userId);
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['preview_project_transfer', 'transfer_project']),
    );
    const preview = await client.callTool({
      name: 'preview_project_transfer',
      arguments: { projectKey: source.ref, targetTeamId: target.id },
    });
    expect(preview).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        status: 200,
        data: { projectId: source.id, canTransfer: true, targetRef: 'destination.MOVE' },
      },
    });
    const args = {
      projectKey: source.ref,
      projectId: source.id,
      sourceTeamId: source.teamId,
      targetTeamId: target.id,
    };
    const moved = await client.callTool({ name: 'transfer_project', arguments: args });
    expect(moved).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        status: 200,
        data: { id: source.id, teamId: target.id, ref: 'destination.MOVE' },
      },
    });
    expect(await client.callTool({ name: 'transfer_project', arguments: args })).toMatchObject({
      isError: false,
      structuredContent: { ok: true, status: 200, data: { id: source.id } },
    });
    expect((await api.projects({ projectKey: source.ref }).get()).status).toBe(404);
  });
});
