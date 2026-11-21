import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

type Client = ReturnType<typeof authedApi>;

async function setupOwnerProject(): Promise<Client> {
  const api = authedApi((await signUpTestUser()).cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  return api;
}

async function addMember(owner: Client): Promise<{ api: Client; userId: string }> {
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: user.userId };
}

function documents(api: Client) {
  return api.projects({ projectKey: 'MKT' }).documents;
}

describe('document pins', () => {
  beforeEach(resetDb);

  it('pins a page for every member without making a new version', async () => {
    const owner = await setupOwnerProject();
    const member = (await addMember(owner)).api;
    const page = (await documents(owner).post({ title: 'Start here' })).data!;
    expect(page.isPinned).toBe(false);

    const pinned = await documents(owner)({ documentId: page.id }).pin.patch({ isPinned: true });
    expect(pinned.status).toBe(200);
    expect(pinned.data).toEqual({ isPinned: true });

    const seen = (await documents(member)({ documentId: page.id }).get()).data!;
    expect(seen).toMatchObject({ isPinned: true, version: page.version });
    expect(seen.updatedAt).toEqual(page.updatedAt);
    expect((await documents(member).get({ query: {} })).data?.[0]).toMatchObject({
      id: page.id,
      isPinned: true,
    });
    expect((await documents(owner)({ documentId: page.id }).revisions.get()).data).toHaveLength(1);

    const unpinned = await documents(owner)({ documentId: page.id }).pin.patch({
      isPinned: false,
    });
    expect(unpinned.data).toEqual({ isPinned: false });
    expect((await documents(member)({ documentId: page.id }).get()).data?.isPinned).toBe(false);
  });

  it('lets only a project admin pin', async () => {
    const owner = await setupOwnerProject();
    const member = (await addMember(owner)).api;
    const outsider = authedApi((await signUpTestUser()).cookie);
    const page = (await documents(owner).post({ title: 'Guide' })).data!;

    expect(
      (await documents(member)({ documentId: page.id }).pin.patch({ isPinned: true })).status,
    ).toBe(403);
    expect(
      (await documents(outsider)({ documentId: page.id }).pin.patch({ isPinned: true })).status,
    ).toBe(403);
    expect((await documents(owner)({ documentId: page.id }).get()).data?.isPinned).toBe(false);
  });

  it('refuses a missing, private or archived page and a body without the flag', async () => {
    const owner = await setupOwnerProject();
    const member = (await addMember(owner)).api;
    const mine = (await documents(owner).post({ title: 'Mine', isPrivate: true })).data!;
    const theirs = (await documents(member).post({ title: 'Theirs', isPrivate: true })).data!;
    const archived = (await documents(owner).post({ title: 'Old' })).data!;
    await documents(owner)({ documentId: archived.id }).archive.post({ version: 1 });

    const pin = (documentId: number) =>
      documents(owner)({ documentId }).pin.patch({ isPinned: true });
    expect((await pin(999_999)).status).toBe(404);
    expect((await pin(theirs.id)).status).toBe(404);
    expect((await pin(mine.id)).status).toBe(400);
    expect((await pin(archived.id)).status).toBe(409);
    expect(
      // @ts-expect-error the body must carry isPinned
      (await documents(owner)({ documentId: archived.id }).pin.patch({})).status,
    ).toBe(400);
    expect((await documents(owner)({ documentId: mine.id }).get()).data?.isPinned).toBe(false);
  });

  it('shows a pin only while its page is public and active', async () => {
    const owner = await setupOwnerProject();
    const page = (await documents(owner).post({ title: 'Guide' })).data!;
    const doc = documents(owner)({ documentId: page.id });
    await doc.pin.patch({ isPinned: true });

    expect((await doc.access.post({ version: 1, isPrivate: true })).data?.isPinned).toBe(false);
    expect((await doc.access.post({ version: 2, isPrivate: false })).data?.isPinned).toBe(true);
    expect((await doc.archive.post({ version: 3 })).data?.isPinned).toBe(false);
    expect((await doc.pin.patch({ isPinned: false })).status).toBe(200);
    expect((await doc.restore.post({ version: 4 })).data?.isPinned).toBe(false);
  });

  it('treats a page shared with chosen members as private', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner);
    const page = (await documents(owner).post({ title: 'Guide' })).data!;
    const doc = documents(owner)({ documentId: page.id });
    await doc.pin.patch({ isPinned: true });

    const shared = await doc.access.post({
      version: 1,
      isPrivate: true,
      memberIds: [member.userId],
    });
    expect(shared.data).toMatchObject({ visibility: 'restricted', isPinned: false });
    expect((await documents(member.api)({ documentId: page.id }).get()).data?.isPinned).toBe(false);
    await doc.pin.patch({ isPinned: false });
    expect((await doc.pin.patch({ isPinned: true })).status).toBe(400);
  });

  it('keeps a pin in a copy of the project', async () => {
    const owner = await setupOwnerProject();
    const page = (await documents(owner).post({ title: 'Start here' })).data!;
    await documents(owner).post({ title: 'Notes' });
    await documents(owner)({ documentId: page.id }).pin.patch({ isPinned: true });

    await owner.projects({ projectKey: 'MKT' }).copy.post({ key: 'CPY', name: 'Copy' });
    const copied = await owner.projects({ projectKey: 'CPY' }).documents.get({ query: {} });
    expect(copied.data?.map((document) => [document.title, document.isPinned])).toEqual([
      ['Start here', true],
      ['Notes', false],
    ]);
  });

  it('closes the route while the Docs section is off', async () => {
    const owner = await setupOwnerProject();
    const page = (await documents(owner).post({ title: 'Guide' })).data!;
    await owner.projects({ projectKey: 'MKT' }).settings.patch({ features: { documents: false } });

    expect(
      (await documents(owner)({ documentId: page.id }).pin.patch({ isPinned: true })).status,
    ).toBe(403);
  });
});
