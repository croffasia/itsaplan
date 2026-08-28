import { describe, it, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Chat attachments: the upload and read routes behind the upload_chat_attachment
// and read_chat_attachment MCP tools, and the public download route the chat
// message links to. Needs MinIO like the attachments suite.

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

function uploadPdf(client: ReturnType<typeof authedApi>, fixture: string) {
  const bytes = readFileSync(new URL(`../fixtures/${fixture}`, import.meta.url));
  return client.projects({ projectKey: 'MKT' })['chat-attachments'].post({
    filename: fixture,
    contentBase64: bytes.toString('base64'),
    contentType: 'application/pdf',
  });
}

function upload(client: ReturnType<typeof authedApi>, filename: string, text: string) {
  return client.projects({ projectKey: 'MKT' })['chat-attachments'].post({
    filename,
    contentBase64: Buffer.from(text).toString('base64'),
    contentType: 'text/csv',
  });
}

describe('chat attachments', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('uploads a file and reads its table back', async () => {
    const { asOwner } = await setup();
    const uploaded = await upload(asOwner, 'tasks.csv', 'Task,Notes\nFirst,hello\nSecond,');
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({
      filename: 'tasks.csv',
      url: expect.stringContaining('/chat-attachments/'),
    });

    const read = await asOwner['chat-attachments']({ publicId: uploaded.data!.id }).get();
    expect(read.status).toBe(200);
    expect(read.data!.table).toEqual({
      headers: ['Task', 'Notes'],
      sampleRows: [
        ['First', 'hello'],
        ['Second', ''],
      ],
      totalRows: 2,
    });
  });

  it('reads a text file in full, however long', async () => {
    const { asOwner } = await setup();
    const long = 'line one\nline two\n' + 'x'.repeat(10_000);
    const uploaded = await asOwner.projects({ projectKey: 'MKT' })['chat-attachments'].post({
      filename: 'server.log',
      contentBase64: Buffer.from(long).toString('base64'),
      contentType: 'text/plain',
    });
    expect(uploaded.status).toBe(201);
    const read = await asOwner['chat-attachments']({ publicId: uploaded.data!.id }).get();
    expect(read.data!.text).toBe(long);
    expect(read.data!.table).toBeUndefined();
  });

  // A browser reports no type for a .md file on some platforms; the extension
  // has to answer for it, or the instance allowlist refuses the upload.
  it('accepts a markdown file the browser could not type', async () => {
    const { asOwner } = await setup();
    const uploaded = await asOwner.projects({ projectKey: 'MKT' })['chat-attachments'].post({
      filename: 'spec.md',
      contentBase64: Buffer.from('# Spec\n\nThe body.').toString('base64'),
    });
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({ contentType: 'text/markdown' });
    const read = await asOwner['chat-attachments']({ publicId: uploaded.data!.id }).get();
    expect(read.data!.text).toBe('# Spec\n\nThe body.');
  });

  it('stores a text PDF as the markdown it converts to', async () => {
    const { asOwner } = await setup();
    const uploaded = await uploadPdf(asOwner, 'text.pdf');
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({
      filename: 'text.md',
      contentType: 'text/markdown',
    });

    const read = await asOwner['chat-attachments']({ publicId: uploaded.data!.id }).get();
    expect(read.data!.text).toContain('# Release Notes');
    expect(read.data!.text).toContain('accepts documents as well as spreadsheets');

    // The public link serves the markdown, not the discarded PDF.
    const raw = await api['chat-attachments']({ publicId: uploaded.data!.id }).raw.get({
      query: { download: '1' },
    });
    expect(String(raw.data)).toBe(read.data!.text!);
  });

  it('refuses a scanned PDF, naming the missing text layer', async () => {
    const { asOwner } = await setup();
    const refused = await uploadPdf(asOwner, 'scanned.pdf');
    expect(refused.status).toBe(400);
    expect(refused.error!.value).toMatchObject({ error: expect.stringContaining('no text layer') });
  });

  it('rejects an empty upload', async () => {
    const { asOwner } = await setup();
    // The schema refuses an empty string...
    const empty = await asOwner.projects({ projectKey: 'MKT' })['chat-attachments'].post({
      filename: 'zero.csv',
      contentBase64: '',
      contentType: 'text/csv',
    });
    expect(empty.status).toBe(400);
    // ...and the route refuses input that does not decode to any bytes.
    const garbage = await asOwner.projects({ projectKey: 'MKT' })['chat-attachments'].post({
      filename: 'zero.csv',
      contentBase64: '!!!!',
      contentType: 'text/csv',
    });
    expect(garbage.status).toBe(400);
  });

  it('denies a non-member uploading or reading', async () => {
    const { asOwner } = await setup();
    const uploaded = await upload(asOwner, 'tasks.csv', 'Task\nOnly');
    const outsider = authedApi((await signUpTestUser()).cookie);
    const write = await upload(outsider, 'tasks.csv', 'Task\nOther');
    expect(write.status).toBe(403);
    const read = await outsider['chat-attachments']({ publicId: uploaded.data!.id }).get();
    expect(read.status).toBe(403);
  });

  it('serves the raw bytes to anyone with the link', async () => {
    const { asOwner } = await setup();
    const uploaded = await upload(asOwner, 'tasks.csv', 'Task\nOnly');

    // The raw route is public: fetch it with the anonymous client (no session).
    const raw = await api['chat-attachments']({ publicId: uploaded.data!.id }).raw.get({
      query: { download: '1' },
    });
    expect(raw.status).toBe(200);
    expect(String(raw.data)).toBe('Task\nOnly');
    expect(raw.response.headers.get('content-disposition')).toContain('attachment');
    expect(raw.response.headers.get('x-content-type-options')).toBe('nosniff');

    const gone = await api['chat-attachments']({
      publicId: '00000000-0000-0000-0000-000000000000',
    }).raw.get();
    expect(gone.status).toBe(404);
  });
});
