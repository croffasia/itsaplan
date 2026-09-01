import { beforeEach, describe, expect, it } from 'bun:test';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

type Client = ReturnType<typeof authedApi>;

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, owner };
}

async function addMember(owner: Client, roleId?: number) {
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const client = authedApi(user.cookie);
  await client.invites({ token: invite.data!.token }).accept.post();
  if (roleId != null) {
    await owner
      .projects({ projectKey: 'MKT' })
      .members({ userId: user.userId })
      .patch({ role: 'member', roleId });
  }
  return { client, user };
}

function documents(client: Client, projectKey = 'MKT') {
  return client.projects({ projectKey }).documents;
}

function upload(client: Client, documentId: number, filename = 'diagram.png', type = 'image/png') {
  return documents(client)({ documentId }).assets.post({
    file: new File(['asset bytes'], filename, { type }),
  });
}

describe('document assets', () => {
  beforeEach(resetDb);

  it('uploads, lists, securely downloads, and deletes an asset', async () => {
    const { asOwner } = await setupProject();
    const page = (await documents(asOwner).post({ title: 'Guide' })).data!;
    const uploaded = await upload(asOwner, page.id, '../unsafe.svg', 'image/svg+xml');
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({
      filename: 'unsafe.svg',
      contentType: 'image/svg+xml',
      sizeBytes: 11,
    });
    expect(uploaded.data!.url).toBe(
      `/projects/MKT/documents/${page.id}/assets/${uploaded.data!.id}/raw`,
    );
    expect(uploaded.data).not.toHaveProperty('s3Key');

    const list = await documents(asOwner)({ documentId: page.id }).assets.get();
    expect(list.data?.map((asset) => asset.id)).toEqual([uploaded.data!.id]);

    const raw = await documents(asOwner)({ documentId: page.id })
      .assets({ publicId: uploaded.data!.id })
      .raw.get();
    expect(raw.status).toBe(200);
    expect(String(raw.data)).toBe('asset bytes');
    expect(raw.response.headers.get('content-disposition')).toContain('attachment');
    expect(raw.response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(raw.response.headers.get('content-security-policy')).toContain('sandbox');
    expect(raw.response.headers.get('cache-control')).toContain('private');

    const anonymous = await api
      .projects({ projectKey: 'MKT' })
      .documents({ documentId: page.id })
      .assets({ publicId: uploaded.data!.id })
      .raw.get();
    expect(anonymous.status).toBe(401);

    expect(
      (
        await documents(asOwner)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .delete()
      ).status,
    ).toBe(204);
    expect(
      (
        await documents(asOwner)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .raw.get()
      ).status,
    ).toBe(404);
  });

  it('keeps private assets owner-only without leaking page or asset existence', async () => {
    const { asOwner } = await setupProject();
    const member = await addMember(asOwner);
    const page = (await documents(asOwner).post({ title: 'Secret', isPrivate: true })).data!;
    const uploaded = await upload(asOwner, page.id);

    expect((await documents(member.client)({ documentId: page.id }).assets.get()).status).toBe(404);
    expect((await upload(member.client, page.id)).status).toBe(404);
    expect(
      (
        await documents(member.client)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .raw.get()
      ).status,
    ).toBe(404);
    expect(
      (
        await documents(member.client)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .delete()
      ).status,
    ).toBe(404);
  });

  it('uses project permissions and refuses writes to locked or archived pages', async () => {
    const { asOwner } = await setupProject();
    const page = (await documents(asOwner).post({ title: 'Public' })).data!;
    const uploaded = await upload(asOwner, page.id);
    const member = await addMember(asOwner);
    expect(
      (
        await documents(member.client)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .delete()
      ).status,
    ).toBe(403);

    const memberPage = (await documents(member.client).post({ title: 'Member page' })).data!;
    const memberAsset = await upload(member.client, memberPage.id, 'member.png');
    expect(
      (
        await documents(asOwner)({ documentId: memberPage.id })
          .assets({ publicId: memberAsset.data!.id })
          .delete()
      ).status,
    ).toBe(204);

    const readerRole = await asOwner
      .projects({ projectKey: 'MKT' })
      .roles.post({ name: 'Reader', permissions: { documents: { read: true } } });
    const reader = await addMember(asOwner, readerRole.data!.id);

    expect((await documents(reader.client)({ documentId: page.id }).assets.get()).status).toBe(200);
    expect(
      (
        await documents(reader.client)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .raw.get()
      ).status,
    ).toBe(200);
    expect((await upload(reader.client, page.id)).status).toBe(403);
    expect(
      (
        await documents(reader.client)({ documentId: page.id })
          .assets({ publicId: uploaded.data!.id })
          .delete()
      ).status,
    ).toBe(403);

    const editorRole = await asOwner.projects({ projectKey: 'MKT' }).roles.post({
      name: 'Docs editor',
      permissions: { documents: { read: true, edit: true } },
    });
    const editor = await addMember(asOwner, editorRole.data!.id);
    const editorAsset = await upload(editor.client, page.id, 'editor.png');
    expect(editorAsset.status).toBe(201);
    expect(
      (
        await documents(editor.client)({ documentId: page.id })
          .assets({ publicId: editorAsset.data!.id })
          .delete()
      ).status,
    ).toBe(403);

    const locked = await documents(asOwner)({ documentId: page.id }).lock.post({ version: 1 });
    expect((await upload(asOwner, page.id)).status).toBe(409);
    const unlocked = await documents(asOwner)({ documentId: page.id }).unlock.post({
      version: locked.data!.version,
    });
    await documents(asOwner)({ documentId: page.id }).archive.post({
      version: unlocked.data!.version,
    });
    expect((await upload(asOwner, page.id)).status).toBe(409);
  });

  it('rejects empty uploads and cross-document asset ids', async () => {
    const { asOwner } = await setupProject();
    const first = (await documents(asOwner).post({ title: 'First' })).data!;
    const second = (await documents(asOwner).post({ title: 'Second' })).data!;
    expect(
      (
        await documents(asOwner)({ documentId: first.id }).assets.post({
          file: new File([], 'empty.txt', { type: 'text/plain' }),
        })
      ).status,
    ).toBe(400);
    const uploaded = await upload(asOwner, first.id);
    expect(
      (
        await documents(asOwner)({ documentId: second.id })
          .assets({ publicId: uploaded.data!.id })
          .raw.get()
      ).status,
    ).toBe(404);
  });

  it('clones asset bytes and rewrites Markdown and JSON when duplicating a page', async () => {
    const { asOwner } = await setupProject();
    const page = (await documents(asOwner).post({ title: 'Source' })).data!;
    const asset = await upload(asOwner, page.id);
    const sourceUrl = asset.data!.url;
    const mediaUrl = `/protected-media${sourceUrl}`;
    const updated = await documents(asOwner)({ documentId: page.id }).patch({
      version: 1,
      content: `![diagram](${mediaUrl})`,
      contentJson: {
        type: 'doc',
        content: [{ type: 'image', attrs: { src: mediaUrl } }],
      },
    });
    const duplicate = await documents(asOwner)({ documentId: page.id }).duplicate.post({
      version: updated.data!.version,
    });
    expect(duplicate.status).toBe(201);
    expect(duplicate.data!.content).not.toContain(mediaUrl);
    expect(JSON.stringify(duplicate.data!.contentJson)).not.toContain(mediaUrl);
    const copiedAssets = await documents(asOwner)({ documentId: duplicate.data!.id }).assets.get();
    expect(copiedAssets.data).toHaveLength(1);
    expect(duplicate.data!.content).toContain(`/protected-media${copiedAssets.data![0].url}`);

    const archived = await documents(asOwner)({ documentId: page.id }).archive.post({
      version: updated.data!.version,
    });
    await documents(asOwner)({ documentId: page.id }).delete(
      {},
      { query: { version: archived.data!.version } },
    );
    const rawCopy = await documents(asOwner)({ documentId: duplicate.data!.id })
      .assets({ publicId: copiedAssets.data![0].id })
      .raw.get();
    expect(String(rawCopy.data)).toBe('asset bytes');
  });

  it('copies assets and embedded URLs with the project', async () => {
    const { asOwner } = await setupProject();
    const page = (await documents(asOwner).post({ title: 'Source' })).data!;
    const asset = await upload(asOwner, page.id);
    const mediaUrl = `/protected-media${asset.data!.url}`;
    await documents(asOwner)({ documentId: page.id }).patch({
      version: 1,
      content: `![diagram](${mediaUrl})`,
      contentJson: { type: 'doc', content: [{ type: 'text', text: mediaUrl }] },
    });
    expect(
      (await asOwner.projects({ projectKey: 'MKT' }).copy.post({ key: 'CPY', name: 'Copy' }))
        .status,
    ).toBe(201);
    const copiedPage = (await documents(asOwner, 'CPY').get({ query: {} })).data![0];
    const copied = await documents(asOwner, 'CPY')({ documentId: copiedPage.id }).get();
    const copiedAssets = await documents(
      asOwner,
      'CPY',
    )({ documentId: copiedPage.id }).assets.get();
    expect(copiedAssets.data).toHaveLength(1);
    expect(copied.data!.content).toContain(`/protected-media${copiedAssets.data![0].url}`);
    expect(copied.data!.content).not.toContain(mediaUrl);
    expect(JSON.stringify(copied.data!.contentJson)).toContain(
      `/protected-media${copiedAssets.data![0].url}`,
    );
  });

  it('removes asset access when an archived page is permanently deleted', async () => {
    const { asOwner } = await setupProject();
    const page = (await documents(asOwner).post({ title: 'Disposable' })).data!;
    const asset = await upload(asOwner, page.id);
    const archived = await documents(asOwner)({ documentId: page.id }).archive.post({ version: 1 });
    expect(
      (
        await documents(asOwner)({ documentId: page.id }).delete(
          {},
          { query: { version: archived.data!.version } },
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await documents(asOwner)({ documentId: page.id })
          .assets({ publicId: asset.data!.id })
          .raw.get()
      ).status,
    ).toBe(404);
  });
});
