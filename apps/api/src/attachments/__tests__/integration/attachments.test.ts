import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Attachments feature: metadata in Postgres, bytes in the object store (shared/
// s3.ts against a real MinIO — see the Tests setup for S3_* env). This is the
// only test that exercises s3.ts (putObject/getObject/deleteObject) and the one
// public, unauthenticated route (GET /attachments/:publicId/raw), which is the
// auth-context session-gate exception.

// Owner with a project and one issue to attach files to. createProject seeds the
// default columns; an issue needs a columnId and a title.
async function setupIssue() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  const issue = await asOwner
    .projects({ projectKey: 'MKT' })
    .issues.post({ columnId, title: 'Task' });
  return { asOwner, issueId: issue.data!.id };
}

function uploadFile(
  client: ReturnType<typeof authedApi>,
  issueId: number,
  name: string,
  type: string,
  content = 'x',
) {
  return client.issues({ issueId }).attachments.post({
    file: new File([content], name, { type }),
  });
}

describe('attachments', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('uploads bytes, serves them on the public raw route, and deletes them', async () => {
    const { asOwner, issueId } = await setupIssue();

    const file = new File(['hello world'], 'note.txt', { type: 'text/plain' });
    const uploaded = await asOwner.issues({ issueId }).attachments.post({ file });
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({ filename: 'note.txt', sizeBytes: 11 });
    expect(uploaded.data!.contentType).toContain('text/plain');
    const publicId = uploaded.data!.id;
    expect(uploaded.data!.url).toBe(`/attachments/${publicId}/raw`);

    const list = await asOwner.issues({ issueId }).attachments.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    // The raw route is public: fetch it with the anonymous client (no session).
    const raw = await api.attachments({ publicId }).raw.get();
    expect(raw.status).toBe(200);
    expect(String(raw.data)).toBe('hello world');

    const del = await asOwner.attachments({ publicId }).delete();
    expect(del.status).toBe(204);

    // Bytes and row are gone.
    const gone = await api.attachments({ publicId }).raw.get();
    expect(gone.status).toBe(404);
  });

  it('rejects an empty file', async () => {
    const { asOwner, issueId } = await setupIssue();
    const empty = new File([], 'empty.txt', { type: 'text/plain' });
    const res = await asOwner.issues({ issueId }).attachments.post({ file: empty });
    expect(res.status).toBe(400);
  });

  it('denies a non-member uploading to an issue', async () => {
    const { issueId } = await setupIssue();
    const outsider = authedApi((await signUpTestUser()).cookie);
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    const res = await outsider.issues({ issueId }).attachments.post({ file });
    expect(res.status).toBe(403);
  });

  describe('list', () => {
    it('returns an empty list for an issue with no attachments', async () => {
      const { asOwner, issueId } = await setupIssue();
      const res = await asOwner.issues({ issueId }).attachments.get();
      expect(res.status).toBe(200);
      expect(res.data).toEqual([]);
    });

    it('returns 404 for an unknown issue', async () => {
      const { asOwner } = await setupIssue();
      const res = await asOwner.issues({ issueId: 999999 }).attachments.get();
      expect(res.status).toBe(404);
    });

    it("denies a non-member listing an issue's attachments", async () => {
      const { issueId } = await setupIssue();
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.issues({ issueId }).attachments.get();
      expect(res.status).toBe(403);
    });
  });

  describe('delete', () => {
    it('returns 404 when deleting a missing attachment', async () => {
      const { asOwner } = await setupIssue();
      const res = await asOwner
        .attachments({ publicId: '00000000-0000-0000-0000-000000000000' })
        .delete();
      expect(res.status).toBe(404);
    });

    it('denies a non-member deleting an attachment', async () => {
      const { asOwner, issueId } = await setupIssue();
      const up = await uploadFile(asOwner, issueId, 'note.txt', 'text/plain');
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.attachments({ publicId: up.data!.id }).delete();
      expect(res.status).toBe(403);
    });
  });

  // The raw route is public and same-origin as the UI, and serves
  // attacker-controlled bytes, so its headers are the XSS defense (see routes.ts).
  describe('raw route headers', () => {
    it('forces download and sets nosniff + CSP for a non-allowlisted type', async () => {
      const { asOwner, issueId } = await setupIssue();
      // SVG passes the upload allowlist (image/*) but is not on the raw route's
      // inline-media allowlist, so it is a stored-XSS vector the headers must defuse.
      const up = await uploadFile(
        asOwner,
        issueId,
        'x.svg',
        'image/svg+xml',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      const raw = await api.attachments({ publicId: up.data!.id }).raw.get();
      expect(raw.status).toBe(200);
      expect(raw.response.headers.get('content-disposition')).toContain('attachment');
      expect(raw.response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(raw.response.headers.get('content-security-policy')).toContain('sandbox');
    });

    it('serves an allowlisted image inline without a CSP', async () => {
      const { asOwner, issueId } = await setupIssue();
      const up = await uploadFile(asOwner, issueId, 'p.png', 'image/png', 'pngbytes');
      const raw = await api.attachments({ publicId: up.data!.id }).raw.get();
      expect(raw.status).toBe(200);
      expect(raw.response.headers.get('content-disposition')).toContain('inline');
      expect(raw.response.headers.get('content-security-policy')).toBeNull();
    });

    it('forces download for an image when ?download is set', async () => {
      const { asOwner, issueId } = await setupIssue();
      const up = await uploadFile(asOwner, issueId, 'p.png', 'image/png', 'pngbytes');
      const raw = await api
        .attachments({ publicId: up.data!.id })
        .raw.get({ query: { download: '1' } });
      expect(raw.response.headers.get('content-disposition')).toContain('attachment');
    });

    it('returns 404 for an unknown publicId', async () => {
      const res = await api
        .attachments({ publicId: '00000000-0000-0000-0000-000000000000' })
        .raw.get();
      expect(res.status).toBe(404);
    });
  });

  describe('import (url or base64)', () => {
    it('stores inline base64 content and serves it', async () => {
      const { asOwner, issueId } = await setupIssue();
      const contentBase64 = Buffer.from('hello').toString('base64');
      const res = await asOwner.issues({ issueId }).attachments.import.post({
        filename: 'note.txt',
        contentBase64,
        contentType: 'text/plain',
      });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ filename: 'note.txt', sizeBytes: 5 });

      const raw = await api.attachments({ publicId: res.data!.id }).raw.get();
      expect(String(raw.data)).toBe('hello');
    });

    it('rejects a request with neither url nor contentBase64', async () => {
      const { asOwner, issueId } = await setupIssue();
      const res = await asOwner.issues({ issueId }).attachments.import.post({ filename: 'x.txt' });
      expect(res.status).toBe(400);
    });

    it('rejects a request with both url and contentBase64', async () => {
      const { asOwner, issueId } = await setupIssue();
      const res = await asOwner.issues({ issueId }).attachments.import.post({
        filename: 'x.txt',
        url: 'https://example.com/x.txt',
        contentBase64: Buffer.from('x').toString('base64'),
      });
      expect(res.status).toBe(400);
    });

    it('rejects a url that points at a private address (SSRF)', async () => {
      const { asOwner, issueId } = await setupIssue();
      const res = await asOwner
        .issues({ issueId })
        .attachments.import.post({ filename: 'x.txt', url: 'https://127.0.0.1/x.txt' });
      expect(res.status).toBe(400);
    });
  });
});
