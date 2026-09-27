import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { buildMcpServer } from '../../server';

// An assistant reads attachments through MCP: every url it is handed is the api's
// public download route, and an image comes back as an image it can look at. The
// stored text keeps the web's /media paths. Needs the object store (MinIO), like the
// attachments tests.

const API = (process.env.API_URL ?? '').replace(/\/+$/, '');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IMAGE_BLOCK = {
  type: 'image' as const,
  data: Buffer.from(PNG).toString('base64'),
  mimeType: 'image/png',
};
const clients: Client[] = [];

async function callTool(client: Client, params: CallToolRequest['params']) {
  return CallToolResultSchema.parse(await client.callTool(params));
}

// The text block an image tool puts before its images.
function named(result: Awaited<ReturnType<typeof callTool>>) {
  const first = result.content[0];
  return first.type === 'text' ? JSON.parse(first.text) : null;
}

async function connect(userId: string) {
  const { key } = await auth.api.createApiKey({ body: { userId, name: 'mcp-attachments' } });
  const server = await buildMcpServer(app, { kind: 'api-key', apiKey: key }, userId);
  const client = new Client({ name: 'mcp-attachments-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  await client.listTools();
  clients.push(client);
  return client;
}

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const issue = await asOwner
    .projects({ projectKey: 'MKT' })
    .issues.post({ columnId: view.data!.columns[0].id, title: 'Task' });
  const issueId = issue.data!.id;
  const image = await asOwner.issues({ issueId }).attachments.post({
    file: new File([PNG], 'shot.png', { type: 'image/png' }),
  });
  const note = await asOwner.issues({ issueId }).attachments.post({
    file: new File(['hello'], 'note.txt', { type: 'text/plain' }),
  });
  const client = await connect(owner.userId);
  return { asOwner, client, issueId, imageId: image.data!.id, noteId: note.data!.id };
}

describe('MCP attachments', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('hands out the api download url and stores the web path', async () => {
    const { asOwner, client, issueId, imageId, noteId } = await setup();
    await asOwner
      .issues({ issueId })
      .patch({ description: `![shot](/media/attachments/${imageId}/raw)` });

    const issue = await callTool(client, { name: 'get_issue', arguments: { issueId } });
    expect(issue.structuredContent).toMatchObject({
      ok: true,
      data: { description: `![shot](${API}/attachments/${imageId}/raw)` },
    });

    const list = await callTool(client, { name: 'list_attachments', arguments: { issueId } });
    const urls = (list.structuredContent?.data as { url: string }[]).map((a) => a.url);
    expect(urls.sort()).toEqual(
      [`${API}/attachments/${imageId}/raw`, `${API}/attachments/${noteId}/raw`].sort(),
    );

    const updated = await callTool(client, {
      name: 'update_issue',
      arguments: { issueId, description: `Before\n\n![shot](${API}/attachments/${imageId}/raw)` },
    });
    expect(updated.isError).toBe(false);
    const stored = await asOwner.issues({ issueId }).get();
    expect(stored.data!.description).toBe(`Before\n\n![shot](/media/attachments/${imageId}/raw)`);
  });

  it('shows the images of an issue and lists the other files with their urls', async () => {
    const { client, issueId, imageId, noteId } = await setup();
    const listed = await client.listTools();
    const viewTool = listed.tools.find((tool) => tool.name === 'view_issue_images');
    expect(viewTool?.outputSchema).toBeUndefined();

    const result = await callTool(client, { name: 'view_issue_images', arguments: { issueId } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: expect.any(String) }, IMAGE_BLOCK]);
    expect(named(result)).toMatchObject({
      images: [{ id: imageId, filename: 'shot.png', contentType: 'image/png' }],
      others: [{ id: noteId, url: `${API}/attachments/${noteId}/raw` }],
    });
  });

  it('shows one image given the url a result carries, or its id', async () => {
    const { client, imageId, noteId } = await setup();

    for (const attachment of [`${API}/attachments/${imageId}/raw`, imageId]) {
      const result = await callTool(client, { name: 'view_attachment', arguments: { attachment } });
      expect(result.content).toEqual([{ type: 'text', text: expect.any(String) }, IMAGE_BLOCK]);
    }

    const note = await callTool(client, {
      name: 'view_attachment',
      arguments: { attachment: `${API}/attachments/${noteId}/raw` },
    });
    expect(note.content).toHaveLength(1);
    expect(named(note)).toMatchObject({
      images: [],
      others: [{ id: noteId, url: `${API}/attachments/${noteId}/raw` }],
    });

    const missing = await callTool(client, {
      name: 'view_attachment',
      arguments: { attachment: 'not an attachment' },
    });
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent).toMatchObject({ ok: false, status: 404 });
  });

  it('does the same for an initiative', async () => {
    const { asOwner, client } = await setup();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .initiatives.post({ title: 'Q3 Launch' });
    const initiativeId = created.data!.id;
    const uploaded = await asOwner.initiatives({ initiativeId }).attachments.post({
      file: new File([PNG], 'plan.png', { type: 'image/png' }),
    });
    const publicId = uploaded.data!.id;

    const list = await callTool(client, {
      name: 'list_initiative_attachments',
      arguments: { initiativeId },
    });
    expect(list.structuredContent).toMatchObject({
      ok: true,
      data: [{ id: publicId, url: `${API}/initiative-attachments/${publicId}/raw` }],
    });

    const all = await callTool(client, {
      name: 'view_initiative_images',
      arguments: { initiativeId },
    });
    expect(all.content).toEqual([{ type: 'text', text: expect.any(String) }, IMAGE_BLOCK]);
    expect(named(all)).toMatchObject({ images: [{ id: publicId }], others: [] });

    const one = await callTool(client, {
      name: 'view_attachment',
      arguments: { attachment: `${API}/initiative-attachments/${publicId}/raw` },
    });
    expect(one.content).toEqual([{ type: 'text', text: expect.any(String) }, IMAGE_BLOCK]);
  });

  it('refuses an image the caller cannot read', async () => {
    const { imageId } = await setup();
    const outsider = await signUpTestUser();
    const client = await connect(outsider.userId);

    const result = await callTool(client, {
      name: 'view_attachment',
      arguments: { attachment: imageId },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, status: 403 });
  });
});
