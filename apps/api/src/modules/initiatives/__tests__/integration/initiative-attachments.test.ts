import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';

// Initiative attachments: metadata in Postgres, bytes in the object store (real
// MinIO — see the api Tests setup for S3_*). The raw route is public, like the
// issue one, so an attachment can be embedded in the description.

async function setupInitiative() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const created = await asOwner
    .projects({ projectKey: 'MKT' })
    .initiatives.post({ title: 'Q3 Launch' });
  return { asOwner, initiativeId: created.data!.id };
}

function upload(
  client: ReturnType<typeof authedApi>,
  initiativeId: number,
  name: string,
  content = 'x',
) {
  return client
    .initiatives({ initiativeId })
    .attachments.post({ file: new File([content], name, { type: 'text/plain' }) });
}

describe('initiative attachments', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(clearLimits);

  it('uploads bytes, serves them on the public raw route, and deletes them', async () => {
    const { asOwner, initiativeId } = await setupInitiative();

    const uploaded = await upload(asOwner, initiativeId, 'note.txt', 'hello world');
    expect(uploaded.status).toBe(201);
    expect(uploaded.data).toMatchObject({ filename: 'note.txt', sizeBytes: 11 });
    const publicId = uploaded.data!.id;
    expect(uploaded.data!.url).toBe(`/initiative-attachments/${publicId}/raw`);

    const list = await asOwner.initiatives({ initiativeId }).attachments.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    // The raw route is public: fetch it with the anonymous client (no session).
    const raw = await api['initiative-attachments']({ publicId }).raw.get();
    expect(raw.status).toBe(200);
    expect(String(raw.data)).toBe('hello world');

    expect((await asOwner['initiative-attachments']({ publicId }).delete()).status).toBe(204);
    expect((await api['initiative-attachments']({ publicId }).raw.get()).status).toBe(404);
    expect((await asOwner.initiatives({ initiativeId }).attachments.get()).data).toHaveLength(0);
  });

  it('strips the embed of a deleted attachment from the description', async () => {
    const { asOwner, initiativeId } = await setupInitiative();
    const uploaded = await upload(asOwner, initiativeId, 'shot.txt');
    const publicId = uploaded.data!.id;

    await asOwner
      .initiatives({ initiativeId })
      .patch({ description: `before\n\n![shot](${uploaded.data!.url})\n\nafter` });
    await asOwner['initiative-attachments']({ publicId }).delete();

    const read = await asOwner.initiatives({ initiativeId }).get();
    expect(read.data!.description).toBe('before\n\nafter');
  });

  it("counts initiative files against the team's storage ceiling", async () => {
    const { asOwner, initiativeId } = await setupInitiative();
    setLimits({ maxStorageBytes: 12 });

    expect((await upload(asOwner, initiativeId, 'a.txt', 'hello')).status).toBe(201);
    expect((await upload(asOwner, initiativeId, 'b.txt', 'hello world!')).status).toBe(413);
    expect((await upload(asOwner, initiativeId, 'c.txt', 'fits')).status).toBe(201);
  });

  it('is closed to a non-member', async () => {
    const { asOwner, initiativeId } = await setupInitiative();
    const publicId = (await upload(asOwner, initiativeId, 'a.txt')).data!.id;
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await outsider.initiatives({ initiativeId }).attachments.get()).status).toBe(403);
    expect((await upload(outsider, initiativeId, 'b.txt')).status).toBe(403);
    expect((await outsider['initiative-attachments']({ publicId }).delete()).status).toBe(403);
  });

  it('404s an attachment that does not exist', async () => {
    const { asOwner } = await setupInitiative();
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await asOwner['initiative-attachments']({ publicId: missing }).delete()).status).toBe(
      404,
    );
    expect((await api['initiative-attachments']({ publicId: missing }).raw.get()).status).toBe(404);
  });
});
