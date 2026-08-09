import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

type Client = ReturnType<typeof authedApi>;

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function setupProject() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  const board = await api.projects({ projectKey: 'MKT' })['note-boards'].post({ name: 'Ideas' });
  return { api, boardId: board.data!.id };
}

async function addMember(owner: Client, permissions: Record<string, unknown>) {
  const role = await owner
    .projects({ projectKey: 'MKT' })
    .roles.post({ name: `Role ${crypto.randomUUID()}`, permissions });
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  await owner
    .projects({ projectKey: 'MKT' })
    .members({ userId: user.userId })
    .patch({ role: 'member', roleId: role.data!.id });
  return { api, userId: user.userId };
}

function images(api: Client, boardId: number) {
  return api.projects({ projectKey: 'MKT' })['note-boards']({ boardId }).images;
}

function png(name = 'photo.png') {
  return new File([PNG_BYTES], name, { type: 'image/png' });
}

describe('note board images', () => {
  beforeEach(resetDb);

  it('uploads, displays, and removes a photo with its canvas node', async () => {
    const { api, boardId } = await setupProject();
    const uploaded = await images(api, boardId).post({ file: png() });
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({ filename: 'photo.png', contentType: 'image/png' });

    const imageId = uploaded.data!.id;
    const raw = await images(api, boardId)({ imageId }).raw.get();
    expect(raw.status).toBe(200);
    expect(raw.response.headers.get('content-disposition')).toContain('inline');
    expect(raw.response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(raw.response.headers.get('cache-control')).toContain('no-store');

    const canvas = {
      nodes: [
        {
          id: 'photo-node',
          type: 'image',
          position: { x: 10, y: 20 },
          width: 320,
          height: 220,
          data: { imageId, filename: 'photo.png', contentType: 'image/png' },
        },
      ],
      edges: [],
    };
    const board = api.projects({ projectKey: 'MKT' })['note-boards']({ boardId });
    expect((await board.patch({ canvas })).status).toBe(200);
    expect((await board.patch({ canvas: { nodes: [], edges: [] } })).status).toBe(200);
    expect((await images(api, boardId)({ imageId }).raw.get()).status).toBe(404);
  });

  it('rejects empty, unsupported, and spoofed image uploads', async () => {
    const { api, boardId } = await setupProject();

    expect(
      (await images(api, boardId).post({ file: new File([], 'empty.png', { type: 'image/png' }) }))
        .status,
    ).toBe(400);
    expect(
      (
        await images(api, boardId).post({
          file: new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await images(api, boardId).post({
          file: new File(['not a png'], 'photo.png', { type: 'image/png' }),
        })
      ).status,
    ).toBe(400);
  });

  it('uses note permissions and preserves private board access', async () => {
    const { api: owner, boardId } = await setupProject();
    const editor = await addMember(owner, {
      note_boards: { read: true, edit: true },
    });
    const reader = await addMember(owner, { note_boards: { read: true } });

    const uploaded = await images(editor.api, boardId).post({ file: png('shared.png') });
    expect(uploaded.status).toBe(201);
    const imageId = uploaded.data!.id;
    expect((await images(reader.api, boardId)({ imageId }).raw.get()).status).toBe(200);
    expect((await images(reader.api, boardId).post({ file: png() })).status).toBe(403);

    await owner
      .projects({ projectKey: 'MKT' })
      ['note-boards']({ boardId })
      .patch({ visibility: 'private' });
    expect((await images(editor.api, boardId)({ imageId }).raw.get()).status).toBe(404);
  });
});
