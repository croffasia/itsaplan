import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { auth } from '@repo/auth';
import { app, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { buildMcpServer } from '../../server';

// An assistant reads the caller's own inbox through MCP: the list, the unread count, and
// marking one or all read. Every call acts as the key's user, so another user's
// notifications are neither listed nor writable.

const clients: Client[] = [];

async function callTool(client: Client, params: CallToolRequest['params']) {
  return CallToolResultSchema.parse(await client.callTool(params));
}

async function connect(userId: string) {
  const { key } = await auth.api.createApiKey({ body: { userId, name: 'mcp-notifications' } });
  const server = await buildMcpServer(app, { kind: 'api-key', apiKey: key }, userId);
  const client = new Client({ name: 'mcp-notifications-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

// The owner assigns two issues to the member and to a third user, so the member's inbox
// holds two notifications and the third user's holds two of their own.
async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;

  async function addMember() {
    const user = await signUpTestUser();
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: user.email, role: 'member' });
    await authedApi(user.cookie).invites({ token: invite.data!.token }).accept.post();
    return user;
  }
  const member = await addMember();
  const other = await addMember();
  for (const assignee of [member, member, other]) {
    await asOwner
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId, title: 'Task', assigneeUserId: assignee.userId });
  }
  return { member, other, client: await connect(member.userId) };
}

describe('MCP inbox notifications', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('lists only the caller’s notifications and counts the unread ones', async () => {
    const { client } = await setup();

    const listed = await callTool(client, { name: 'list_notifications' });
    expect(listed.isError).toBe(false);
    const items = (listed.structuredContent as { data: { items: { type: string }[] } }).data.items;
    expect(items.map((item) => item.type)).toEqual(['assigned', 'assigned']);

    const count = await callTool(client, { name: 'get_unread_notification_count' });
    expect(count.structuredContent).toMatchObject({ ok: true, data: { unread: 2 } });
  });

  it('marks one notification read and unread, and filters the list by read state', async () => {
    const { client } = await setup();
    const listed = await callTool(client, { name: 'list_notifications' });
    const [first] = (listed.structuredContent as { data: { items: { id: number }[] } }).data.items;

    const read = await callTool(client, {
      name: 'mark_notification_read',
      arguments: { id: first.id },
    });
    expect(read.isError).toBe(false);
    const unreadOnly = await callTool(client, {
      name: 'list_notifications',
      arguments: { includeRead: 'false' },
    });
    const unread = (unreadOnly.structuredContent as { data: { items: { id: number }[] } }).data
      .items;
    expect(unread.map((item) => item.id)).not.toContain(first.id);
    expect(unread).toHaveLength(1);

    await callTool(client, {
      name: 'mark_notification_read',
      arguments: { id: first.id, read: false },
    });
    const count = await callTool(client, { name: 'get_unread_notification_count' });
    expect(count.structuredContent).toMatchObject({ data: { unread: 2 } });
  });

  it('marks every notification read and leaves another user’s untouched', async () => {
    const { client, other } = await setup();

    const all = await callTool(client, { name: 'mark_all_notifications_read' });
    expect(all.structuredContent).toMatchObject({ ok: true, data: { count: 2 } });
    const count = await callTool(client, { name: 'get_unread_notification_count' });
    expect(count.structuredContent).toMatchObject({ data: { unread: 0 } });

    const otherCount = await authedApi(other.cookie).notifications.unread.get({ query: {} });
    expect(otherCount.data).toEqual({ unread: 1 });
  });

  it('does not reach a notification that belongs to someone else', async () => {
    const { client, other } = await setup();
    const theirs = await authedApi(other.cookie).notifications.get({ query: {} });
    const result = await callTool(client, {
      name: 'mark_notification_read',
      arguments: { id: theirs.data!.items[0].id },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 404 });
  });
});
