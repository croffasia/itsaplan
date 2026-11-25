import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@repo/db';
import { sql } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';

type Client = ReturnType<typeof authedApi>;
type Placement = { afterId?: number; beforeId?: number };

async function setupOwnerProject(): Promise<Client> {
  const api = authedApi((await signUpTestUser()).cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  return api;
}

async function addMember(owner: Client, roleId?: number): Promise<{ api: Client; userId: string }> {
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member', roleId });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: user.userId };
}

function documents(api: Client, projectKey = 'MKT') {
  return api.projects({ projectKey }).documents;
}

function pin(api: Client, documentId: number, placement: Placement = {}, projectKey = 'MKT') {
  return documents(api, projectKey)({ documentId }).pin.patch({ isPinned: true, ...placement });
}

async function createPages(api: Client, titles: string[]) {
  const pages = [];
  for (const title of titles) pages.push((await documents(api).post({ title })).data!);
  return pages;
}

async function pinnedPages(api: Client, titles: string[]) {
  const pages = await createPages(api, titles);
  for (const page of pages) await pin(api, page.id);
  return pages;
}

// The titles of the pinned pages in the order the Docs home shows them.
async function pinOrder(api: Client, projectKey = 'MKT'): Promise<string[]> {
  const list = (await documents(api, projectKey).get({ query: {} })).data!;
  return list
    .filter((page) => page.isPinned)
    .sort((a, b) => a.pinPosition! - b.pinPosition! || a.id - b.id)
    .map((page) => page.title);
}

// No route writes a pinned page without a place, the state a release before pin positions
// left behind, so the test drops the column and runs its migration again.
async function rerunPinPositionMigration(): Promise<void> {
  const migration = new URL(
    '../drizzle/0201_document_pin_position.sql',
    import.meta.resolve('@repo/db'),
  );
  const statements = readFileSync(migration, 'utf8').split('--> statement-breakpoint');
  await db.transaction(async (tx) => {
    await tx.execute(sql`alter table "project_document" drop column "pin_position"`);
    for (const statement of statements) await tx.execute(sql.raw(statement));
  });
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

  it('lets a member who may edit pages pin, and refuses one who may not', async () => {
    const owner = await setupOwnerProject();
    const editor = (await addMember(owner)).api;
    const readerRole = await createRole(owner, 'MKT', {
      name: 'Reader',
      permissions: { documents: { read: true } },
    });
    const reader = (await addMember(owner, readerRole.data!.id)).api;
    const outsider = authedApi((await signUpTestUser()).cookie);
    const page = (await documents(owner).post({ title: 'Guide' })).data!;
    const pin = (api: Client, isPinned: boolean) =>
      documents(api)({ documentId: page.id }).pin.patch({ isPinned });

    expect((await pin(reader, true)).status).toBe(403);
    expect((await pin(outsider, true)).status).toBe(403);
    expect((await documents(owner)({ documentId: page.id }).get()).data?.isPinned).toBe(false);

    expect((await pin(editor, true)).status).toBe(200);
    expect((await documents(reader)({ documentId: page.id }).get()).data?.isPinned).toBe(true);
    expect((await pin(reader, false)).status).toBe(403);
    expect((await pin(editor, false)).data).toEqual({ isPinned: false });
  });

  it('refuses an editor on a private, restricted or archived page', async () => {
    const owner = await setupOwnerProject();
    const editor = await addMember(owner);
    const other = await addMember(owner);
    const hidden = (await documents(owner).post({ title: 'Hidden', isPrivate: true })).data!;
    const shared = (await documents(owner).post({ title: 'Shared' })).data!;
    await documents(owner)({ documentId: shared.id }).access.post({
      version: 1,
      isPrivate: true,
      memberIds: [editor.userId],
    });
    const mine = (await documents(editor.api).post({ title: 'Mine', isPrivate: true })).data!;
    const archived = (await documents(owner).post({ title: 'Old' })).data!;
    await documents(owner)({ documentId: archived.id }).archive.post({ version: 1 });

    const pin = (api: Client, documentId: number) =>
      documents(api)({ documentId }).pin.patch({ isPinned: true });
    expect((await pin(editor.api, hidden.id)).status).toBe(404);
    expect((await pin(other.api, shared.id)).status).toBe(404);
    expect((await pin(editor.api, shared.id)).status).toBe(400);
    expect((await pin(editor.api, mine.id)).status).toBe(400);
    expect((await pin(editor.api, archived.id)).status).toBe(409);
    for (const id of [hidden.id, shared.id, archived.id]) {
      expect((await documents(owner)({ documentId: id }).get()).data?.isPinned).toBe(false);
    }
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

  it('keeps the pins and their order in a copy of the project', async () => {
    const owner = await setupOwnerProject();
    const [start, notes] = await createPages(owner, ['Start here', 'Notes', 'Drafts']);
    await pin(owner, notes.id);
    await pin(owner, start.id);

    await owner.projects({ projectKey: 'MKT' }).copy.post({ key: 'CPY', name: 'Copy' });
    const copied = await owner.projects({ projectKey: 'CPY' }).documents.get({ query: {} });
    expect(copied.data?.map((document) => [document.title, document.isPinned])).toEqual([
      ['Start here', true],
      ['Notes', true],
      ['Drafts', false],
    ]);
    expect(await pinOrder(owner, 'CPY')).toEqual(['Notes', 'Start here']);
  });

  it('puts a new pin last and leaves a pinned page in its place when pinned again', async () => {
    const owner = await setupOwnerProject();
    const [first, second, third] = await createPages(owner, ['First', 'Second', 'Third']);
    for (const page of [third, first, second]) expect((await pin(owner, page.id)).status).toBe(200);
    expect(await pinOrder(owner)).toEqual(['Third', 'First', 'Second']);

    expect((await pin(owner, third.id)).data).toEqual({ isPinned: true });
    expect(await pinOrder(owner)).toEqual(['Third', 'First', 'Second']);
  });

  it('moves a pinned page before, after or between others without a new version', async () => {
    const owner = await setupOwnerProject();
    const member = (await addMember(owner)).api;
    const [a, b, c] = await pinnedPages(owner, ['A', 'B', 'C']);

    expect((await pin(member, c.id, { beforeId: a.id })).data).toEqual({ isPinned: true });
    expect(await pinOrder(owner)).toEqual(['C', 'A', 'B']);
    expect((await pin(member, c.id, { afterId: b.id })).status).toBe(200);
    expect(await pinOrder(owner)).toEqual(['A', 'B', 'C']);
    expect((await pin(member, a.id, { afterId: b.id, beforeId: c.id })).status).toBe(200);
    expect(await pinOrder(member)).toEqual(['B', 'A', 'C']);

    const moved = (await documents(owner)({ documentId: a.id }).get()).data!;
    expect(moved).toMatchObject({ version: a.version, updatedAt: a.updatedAt });
    expect((await documents(owner)({ documentId: a.id }).revisions.get()).data).toHaveLength(1);
  });

  it('moves only the moved pin until no room is left between two pins', async () => {
    const owner = await setupOwnerProject();
    const [a, b, c] = await pinnedPages(owner, ['A', 'B', 'C']);
    const places = async () =>
      Object.fromEntries(
        (await documents(owner).get({ query: {} })).data!.map((page) => [
          page.id,
          page.pinPosition,
        ]),
      );

    await pin(owner, c.id, { afterId: a.id, beforeId: b.id });
    expect(await places()).toEqual({ [a.id]: 1024, [b.id]: 2048, [c.id]: 1536 });

    // The page after A moves between A and the next one, which halves the room after A.
    let [next, last] = [c, b];
    let moves = 1;
    while ((await places())[next.id] !== 2048) {
      expect(moves).toBeLessThan(80);
      expect((await pin(owner, last.id, { afterId: a.id, beforeId: next.id })).status).toBe(200);
      [next, last] = [last, next];
      moves += 1;
    }
    expect(moves).toBeGreaterThan(40);
    expect(await places()).toEqual({ [a.id]: 1024, [next.id]: 2048, [last.id]: 3072 });
    expect(await pinOrder(owner)).toEqual(['A', next.title, last.title]);
    for (const page of [a, b, c]) {
      expect((await documents(owner)({ documentId: page.id }).get()).data?.version).toBe(1);
    }
  });

  it('pins a page straight into a place', async () => {
    const owner = await setupOwnerProject();
    const [, b] = await pinnedPages(owner, ['A', 'B']);
    const page = (await documents(owner).post({ title: 'New' })).data!;

    expect((await pin(owner, page.id, { beforeId: b.id })).status).toBe(200);
    expect(await pinOrder(owner)).toEqual(['A', 'New', 'B']);
  });

  it('clears the place of an unpinned page, so it goes last when pinned again', async () => {
    const owner = await setupOwnerProject();
    const [a] = await pinnedPages(owner, ['A', 'B', 'C']);
    const doc = documents(owner)({ documentId: a.id });

    expect((await doc.pin.patch({ isPinned: false })).data).toEqual({ isPinned: false });
    expect((await doc.get()).data).toMatchObject({ isPinned: false, pinPosition: null });
    expect(await pinOrder(owner)).toEqual(['B', 'C']);
    await pin(owner, a.id);
    expect(await pinOrder(owner)).toEqual(['B', 'C', 'A']);
  });

  it('keeps the place of a pin hidden while its page is private, and never anchors on it', async () => {
    const owner = await setupOwnerProject();
    const [a, b, c] = await pinnedPages(owner, ['A', 'B', 'C']);
    const hidden = documents(owner)({ documentId: b.id });
    await hidden.access.post({ version: 1, isPrivate: true });
    expect((await hidden.get()).data).toMatchObject({ isPinned: false, pinPosition: null });

    expect((await pin(owner, c.id, { afterId: b.id })).status).toBe(409);
    expect((await pin(owner, c.id, { beforeId: a.id })).status).toBe(200);
    expect(await pinOrder(owner)).toEqual(['C', 'A']);
    await hidden.access.post({ version: 2, isPrivate: false });
    expect(await pinOrder(owner)).toEqual(['C', 'A', 'B']);
  });

  it('refuses a place next to a page that is not pinned here, or in a stale order', async () => {
    const owner = await setupOwnerProject();
    const [a, b, c] = await pinnedPages(owner, ['A', 'B', 'C']);
    const loose = (await documents(owner).post({ title: 'Loose' })).data!;
    await createProject(owner, { key: 'OPS', name: 'Ops' });
    const elsewhere = (await documents(owner, 'OPS').post({ title: 'Elsewhere' })).data!;
    await pin(owner, elsewhere.id, {}, 'OPS');

    expect((await pin(owner, c.id, { afterId: loose.id })).status).toBe(409);
    expect((await pin(owner, c.id, { afterId: elsewhere.id })).status).toBe(409);
    expect((await pin(owner, c.id, { beforeId: 999_999 })).status).toBe(409);
    const stale = await pin(owner, a.id, { afterId: c.id, beforeId: b.id });
    expect(stale.status).toBe(409);
    expect(stale.error?.value).toMatchObject({ error: expect.stringContaining('Reload') });
    expect((await pin(owner, c.id, { afterId: c.id })).status).toBe(400);
    expect((await pin(owner, c.id, { afterId: 0 })).status).toBe(400);
    expect(
      (await documents(owner)({ documentId: c.id }).pin.patch({ isPinned: false, beforeId: a.id }))
        .status,
    ).toBe(400);
    expect(await pinOrder(owner)).toEqual(['A', 'B', 'C']);
  });

  it('lets a member who may pin move a pin, and refuses one who may not', async () => {
    const owner = await setupOwnerProject();
    const editor = (await addMember(owner)).api;
    const readerRole = await createRole(owner, 'MKT', {
      name: 'Reader',
      permissions: { documents: { read: true } },
    });
    const reader = (await addMember(owner, readerRole.data!.id)).api;
    const outsider = authedApi((await signUpTestUser()).cookie);
    const [a, , c] = await pinnedPages(owner, ['A', 'B', 'C']);

    expect((await pin(reader, c.id, { beforeId: a.id })).status).toBe(403);
    expect((await pin(outsider, c.id, { beforeId: a.id })).status).toBe(403);
    expect(await pinOrder(reader)).toEqual(['A', 'B', 'C']);
    expect((await pin(editor, c.id, { beforeId: a.id })).status).toBe(200);
    expect(await pinOrder(reader)).toEqual(['C', 'A', 'B']);
  });

  it('places the pages pinned before the upgrade in the order the home showed them', async () => {
    const owner = await setupOwnerProject();
    const [a, b, c] = await createPages(owner, ['A', 'B', 'C']);
    const child = (await documents(owner).post({ title: 'Child', parentId: a.id })).data!;
    const archived = (await documents(owner).post({ title: 'Archived' })).data!;
    for (const page of [archived, c, child, b, a]) await pin(owner, page.id);
    await documents(owner)({ documentId: archived.id }).archive.post({ version: 1 });
    await createProject(owner, { key: 'OPS', name: 'Ops' });
    const other = (await documents(owner, 'OPS').post({ title: 'Other' })).data!;
    await pin(owner, other.id, {}, 'OPS');
    expect(await pinOrder(owner)).toEqual(['C', 'Child', 'B', 'A']);

    await rerunPinPositionMigration();

    // The tree position of Child, first under A, equals that of A, so the id decides.
    expect(await pinOrder(owner)).toEqual(['A', 'Child', 'B', 'C']);
    expect((await documents(owner, 'OPS').get({ query: {} })).data?.[0]?.pinPosition).toBe(1024);
    await documents(owner)({ documentId: archived.id }).restore.post({ version: 2 });
    expect(await pinOrder(owner)).toEqual(['A', 'Child', 'B', 'C', 'Archived']);
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
