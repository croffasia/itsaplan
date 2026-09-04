import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

type Client = ReturnType<typeof authedApi>;

async function setupOwnerProject(): Promise<{ api: Client; userId: string }> {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  return { api, userId: owner.userId };
}

async function addMember(owner: Client, roleId?: number): Promise<{ api: Client; userId: string }> {
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  if (roleId != null) {
    await owner
      .projects({ projectKey: 'MKT' })
      .members({ userId: user.userId })
      .patch({ role: 'member', roleId });
  }
  return { api, userId: user.userId };
}

function documents(api: Client, projectKey = 'MKT') {
  return api.projects({ projectKey }).documents;
}

describe('documents', () => {
  beforeEach(resetDb);

  it('creates, lists, reads, searches, updates, and deletes a document', async () => {
    const owner = await setupOwnerProject();

    const created = await documents(owner.api).post({ title: 'Release guide' });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      title: 'Release guide',
      content: '',
      parentId: null,
      version: 1,
      position: 1024,
      createdByUserId: owner.userId,
      updatedByUserId: owner.userId,
    });

    const documentId = created.data!.id;
    const updated = await documents(owner.api)({ documentId }).patch({
      version: 1,
      title: 'Production release guide',
      content: '# Deploy\n\nRun the release workflow.',
    });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({
      title: 'Production release guide',
      content: '# Deploy\n\nRun the release workflow.',
      version: 2,
      updatedByUserId: owner.userId,
    });

    const list = await documents(owner.api).get({ query: {} });
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);
    expect(list.data?.[0]).toMatchObject({ id: documentId, version: 2 });
    expect(list.data?.[0]).not.toHaveProperty('content');
    expect(list.data?.[0]).not.toHaveProperty('contentJson');

    const byTitle = await documents(owner.api).get({ query: { q: 'production' } });
    const byContent = await documents(owner.api).get({ query: { q: 'workflow' } });
    const noMatch = await documents(owner.api).get({ query: { q: 'onboarding' } });
    expect(byTitle.data?.map((document) => document.id)).toEqual([documentId]);
    expect(byContent.data?.map((document) => document.id)).toEqual([documentId]);
    expect(noMatch.data).toEqual([]);

    const read = await documents(owner.api)({ documentId }).get();
    expect(read.status).toBe(200);
    expect(read.data).toMatchObject(updated.data!);

    const archived = await documents(owner.api)({ documentId }).archive.post({ version: 2 });
    expect(archived.status).toBe(200);
    expect(
      (
        await documents(owner.api)({ documentId }).delete(
          {},
          { query: { version: archived.data!.version } },
        )
      ).status,
    ).toBe(204);
    expect((await documents(owner.api)({ documentId }).get()).status).toBe(404);
  });

  it('builds a tree and rejects self, descendant, and cross-project parents', async () => {
    const { api } = await setupOwnerProject();
    const root = (await documents(api).post({ title: 'Root' })).data!;
    const child = (await documents(api).post({ title: 'Child', parentId: root.id })).data!;
    const grandchild = (await documents(api).post({ title: 'Grandchild', parentId: child.id }))
      .data!;

    expect(child.parentId).toBe(root.id);
    expect(grandchild.parentId).toBe(child.id);
    expect(
      (await documents(api)({ documentId: root.id }).patch({ version: 1, parentId: root.id }))
        .status,
    ).toBe(400);
    expect(
      (await documents(api)({ documentId: root.id }).patch({ version: 1, parentId: grandchild.id }))
        .status,
    ).toBe(400);

    await api.projects.post({ key: 'OPS', name: 'Operations' });
    const other = (await documents(api, 'OPS').post({ title: 'Other' })).data!;
    expect((await documents(api).post({ title: 'Invalid', parentId: other.id })).status).toBe(400);
    expect(
      (await documents(api)({ documentId: child.id }).patch({ version: 1, parentId: other.id }))
        .status,
    ).toBe(400);

    const list = await documents(api).get({ query: {} });
    expect(list.data).toMatchObject([
      { id: root.id, parentId: null },
      { id: child.id, parentId: root.id },
      { id: grandchild.id, parentId: child.id },
    ]);
  });

  it('serializes concurrent moves so they cannot create a cycle', async () => {
    const { api } = await setupOwnerProject();
    const first = (await documents(api).post({ title: 'First' })).data!;
    const second = (await documents(api).post({ title: 'Second' })).data!;

    const results = await Promise.all([
      documents(api)({ documentId: first.id }).patch({ version: 1, parentId: second.id }),
      documents(api)({ documentId: second.id }).patch({ version: 1, parentId: first.id }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);

    const currentFirst = (await documents(api)({ documentId: first.id }).get()).data!;
    const currentSecond = (await documents(api)({ documentId: second.id }).get()).data!;
    expect(currentFirst.parentId === null || currentSecond.parentId === null).toBe(true);
  });

  it('rebalances anchored drag positions without midpoint saturation', async () => {
    const { api } = await setupOwnerProject();
    const first = (await documents(api).post({ title: 'First' })).data!;
    const second = (await documents(api).post({ title: 'Second' })).data!;
    let moving = (await documents(api).post({ title: 'Moving' })).data!;

    for (let index = 0; index < 60; index += 1) {
      const between = index % 2 === 0;
      const moved = await documents(api)({ documentId: moving.id }).patch({
        version: moving.version,
        parentId: null,
        position: between ? 1536 : 4096,
        previousSiblingId: between ? first.id : second.id,
        nextSiblingId: between ? second.id : null,
      });
      expect(moved.status).toBe(200);
      moving = moved.data!;
      const ordered = (await documents(api).get({ query: {} })).data!;
      expect(ordered.map((page) => page.title)).toEqual(
        between ? ['First', 'Moving', 'Second'] : ['First', 'Second', 'Moving'],
      );
      expect(ordered.map((page) => page.position)).toEqual(
        between ? [1024, 1536, 2048] : [1024, 2048, 3072],
      );
    }

    const stable = (await documents(api).get({ query: {} })).data!;
    expect(stable.every((page) => Number.isFinite(page.position))).toBe(true);
    expect(stable.find((page) => page.id === first.id)?.version).toBe(1);
    expect(stable.find((page) => page.id === second.id)?.version).toBe(1);
    expect(
      (await documents(api)({ documentId: first.id }).revisions.get()).data?.map(
        (revision) => revision.version,
      ),
    ).toEqual([1]);
    expect(
      (await documents(api)({ documentId: second.id }).revisions.get()).data?.map(
        (revision) => revision.version,
      ),
    ).toEqual([1]);
  });

  it('rebalances only when sibling position precision is exhausted', async () => {
    const { api } = await setupOwnerProject();
    const first = (await documents(api).post({ title: 'First' })).data!;
    const second = (await documents(api).post({ title: 'Second' })).data!;
    const moving = (await documents(api).post({ title: 'Moving' })).data!;
    const firstTight = await documents(api)({ documentId: first.id }).patch({
      version: first.version,
      position: 1,
    });
    const secondTight = await documents(api)({ documentId: second.id }).patch({
      version: second.version,
      position: 1 + Number.EPSILON,
    });
    const historiesBefore = await Promise.all([
      documents(api)({ documentId: first.id }).revisions.get(),
      documents(api)({ documentId: second.id }).revisions.get(),
    ]);

    const moved = await documents(api)({ documentId: moving.id }).patch({
      version: moving.version,
      parentId: null,
      position: 1,
      previousSiblingId: first.id,
      nextSiblingId: second.id,
    });
    expect(moved.status).toBe(200);
    const ordered = (await documents(api).get({ query: {} })).data!;
    expect(ordered.map((page) => page.title)).toEqual(['First', 'Moving', 'Second']);
    expect(ordered.map((page) => page.position)).toEqual([1024, 2048, 3072]);
    expect(ordered.find((page) => page.id === first.id)?.version).toBe(firstTight.data!.version);
    expect(ordered.find((page) => page.id === second.id)?.version).toBe(secondTight.data!.version);
    const historiesAfter = await Promise.all([
      documents(api)({ documentId: first.id }).revisions.get(),
      documents(api)({ documentId: second.id }).revisions.get(),
    ]);
    expect(historiesAfter.map((response) => response.data)).toEqual(
      historiesBefore.map((response) => response.data),
    );
  });

  it('serializes anchored and position-only moves without losing a successful write', async () => {
    const { api } = await setupOwnerProject();
    const first = (await documents(api).post({ title: 'First' })).data!;
    const second = (await documents(api).post({ title: 'Second' })).data!;
    const moving = (await documents(api).post({ title: 'Moving' })).data!;

    const [anchored, rawPosition] = await Promise.all([
      documents(api)({ documentId: moving.id }).patch({
        version: moving.version,
        parentId: null,
        position: 1536,
        previousSiblingId: first.id,
        nextSiblingId: second.id,
      }),
      documents(api)({ documentId: moving.id }).patch({
        version: moving.version,
        position: 8192,
      }),
    ]);

    expect([anchored.status, rawPosition.status].sort()).toEqual([200, 409]);
    const successful = anchored.status === 200 ? anchored.data! : rawPosition.data!;
    const current = await documents(api)({ documentId: moving.id }).get();
    expect(current.data).toMatchObject({
      version: successful.version,
      position: successful.position,
    });
    expect(current.data?.version).toBe(moving.version + 1);
  });

  it('rejects a stale update without overwriting the current document', async () => {
    const { api } = await setupOwnerProject();
    const created = (await documents(api).post({ title: 'Runbook' })).data!;

    const first = await documents(api)({ documentId: created.id }).patch({
      version: created.version,
      content: 'Current content',
    });
    expect(first.status).toBe(200);
    expect(first.data?.version).toBe(2);

    const stale = await documents(api)({ documentId: created.id }).patch({
      version: created.version,
      content: 'Stale content',
    });
    expect(stale.status).toBe(409);

    const read = await documents(api)({ documentId: created.id }).get();
    expect(read.data).toMatchObject({ content: 'Current content', version: 2 });

    const staleDelete = await documents(api)({ documentId: created.id }).delete(
      {},
      {
        query: { version: created.version },
      },
    );
    expect(staleDelete.status).toBe(409);
    expect((await documents(api)({ documentId: created.id }).get()).data).toMatchObject({
      content: 'Current content',
      version: 2,
    });
  });

  it('moves children to the root when their parent is deleted', async () => {
    const { api } = await setupOwnerProject();
    const parent = (await documents(api).post({ title: 'Parent' })).data!;
    const child = (await documents(api).post({ title: 'Child', parentId: parent.id })).data!;

    const archived = await documents(api)({ documentId: parent.id }).archive.post({ version: 1 });
    expect(archived.status).toBe(200);
    expect(
      (
        await documents(api)({ documentId: parent.id }).delete(
          {},
          { query: { version: archived.data!.version } },
        )
      ).status,
    ).toBe(204);
    expect(await documents(api)({ documentId: child.id }).get()).toMatchObject({
      status: 200,
      data: { parentId: null, version: 3 },
    });
  });

  it('enforces document permissions for default, read-only, and blocked members', async () => {
    const owner = await setupOwnerProject();
    const document = (await documents(owner.api).post({ title: 'Shared' })).data!;
    const member = await addMember(owner.api);

    const memberDocument = await documents(member.api).post({ title: 'Member page' });
    expect(memberDocument.status).toBe(201);
    expect(
      (
        await documents(member.api)({ documentId: memberDocument.data!.id }).patch({
          version: 1,
          title: 'Member edit',
        })
      ).status,
    ).toBe(200);
    const archivedMemberDocument = await documents(member.api)({
      documentId: memberDocument.data!.id,
    }).archive.post({ version: 2 });
    expect(archivedMemberDocument.status).toBe(200);
    expect(
      (
        await documents(member.api)({ documentId: memberDocument.data!.id }).delete(
          {},
          {
            query: { version: archivedMemberDocument.data!.version },
          },
        )
      ).status,
    ).toBe(204);

    const readerRole = await owner.api
      .projects({ projectKey: 'MKT' })
      .roles.post({ name: 'Reader', permissions: { documents: { read: true } } });
    const reader = await addMember(owner.api, readerRole.data!.id);
    expect((await documents(reader.api).get({ query: {} })).status).toBe(200);
    expect((await documents(reader.api)({ documentId: document.id }).get()).status).toBe(200);
    expect((await documents(reader.api).post({ title: 'Nope' })).status).toBe(403);
    expect(
      (
        await documents(reader.api)({ documentId: document.id }).patch({
          version: document.version,
          title: 'Nope',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await documents(reader.api)({ documentId: document.id }).delete(
          {},
          {
            query: { version: document.version },
          },
        )
      ).status,
    ).toBe(403);

    const blockedRole = await owner.api
      .projects({ projectKey: 'MKT' })
      .roles.post({ name: 'No documents', permissions: {} });
    const blocked = await addMember(owner.api, blockedRole.data!.id);
    expect((await documents(blocked.api).get({ query: {} })).status).toBe(403);
    expect((await documents(blocked.api)({ documentId: document.id }).get()).status).toBe(403);
  });

  it('links visible Docs and work items in both directions with combined permissions', async () => {
    const owner = await setupOwnerProject();
    const project = await owner.api.projects({ projectKey: 'MKT' }).get();
    const workItem = (
      await owner.api
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: project.data!.columns[0]!.id, title: 'Ship release' })
    ).data!;
    const page = (await documents(owner.api).post({ title: 'Release guide' })).data!;

    const linked = await documents(owner.api)({ documentId: page.id }).issues.post({
      issueId: workItem.id,
    });
    expect(linked.status).toBe(201);
    expect(linked.data).toMatchObject({
      issueId: workItem.id,
      identifier: 'MKT-1',
      title: 'Ship release',
    });
    expect((await documents(owner.api)({ documentId: page.id }).issues.get()).data).toMatchObject([
      { issueId: workItem.id, identifier: 'MKT-1' },
    ]);
    expect(
      (await documents(owner.api)['for-issue']({ issueId: workItem.id }).get()).data,
    ).toMatchObject([{ documentId: page.id, title: 'Release guide' }]);
    expect(
      (
        await documents(owner.api)({ documentId: page.id })
          .issues({ issueId: workItem.id })
          .delete()
      ).status,
    ).toBe(204);

    const readerRole = await owner.api.projects({ projectKey: 'MKT' }).roles.post({
      name: 'Context reader',
      permissions: { documents: { read: true }, work_items: { read: true } },
    });
    const reader = await addMember(owner.api, readerRole.data!.id);
    expect((await documents(reader.api)({ documentId: page.id }).issues.get()).status).toBe(200);
    expect(
      (
        await documents(reader.api)({ documentId: page.id }).issues.post({
          issueId: workItem.id,
        })
      ).status,
    ).toBe(403);

    const privatePage = (await documents(owner.api).post({ title: 'Owner notes', isPrivate: true }))
      .data!;
    await documents(owner.api)({ documentId: privatePage.id }).issues.post({
      issueId: workItem.id,
    });
    expect((await documents(reader.api)['for-issue']({ issueId: workItem.id }).get()).data).toEqual(
      [],
    );
  });

  it('limits permanent deletion to the page owner or a project owner for public pages', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);

    const ownerPage = (await documents(owner.api).post({ title: 'Owner page' })).data!;
    const archivedOwnerPage = await documents(owner.api)({
      documentId: ownerPage.id,
    }).archive.post({ version: ownerPage.version });
    expect(
      (
        await documents(member.api)({ documentId: ownerPage.id }).delete(
          {},
          { query: { version: archivedOwnerPage.data!.version } },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await documents(owner.api)({ documentId: ownerPage.id }).delete(
          {},
          { query: { version: archivedOwnerPage.data!.version } },
        )
      ).status,
    ).toBe(204);

    const memberPage = (await documents(member.api).post({ title: 'Member public page' })).data!;
    const archivedMemberPage = await documents(member.api)({
      documentId: memberPage.id,
    }).archive.post({ version: memberPage.version });
    expect(
      (
        await documents(owner.api)({ documentId: memberPage.id }).delete(
          {},
          { query: { version: archivedMemberPage.data!.version } },
        )
      ).status,
    ).toBe(204);

    const privatePage = (
      await documents(member.api).post({ title: 'Member private page', isPrivate: true })
    ).data!;
    const archivedPrivatePage = await documents(member.api)({
      documentId: privatePage.id,
    }).archive.post({ version: privatePage.version });
    expect(
      (
        await documents(owner.api)({ documentId: privatePage.id }).delete(
          {},
          { query: { version: archivedPrivatePage.data!.version } },
        )
      ).status,
    ).toBe(404);
  });

  it('denies an outsider and hides documents that belong to another project', async () => {
    const owner = await setupOwnerProject();
    const document = (await documents(owner.api).post({ title: 'Private' })).data!;
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await documents(outsider).get({ query: {} })).status).toBe(403);
    expect((await documents(outsider)({ documentId: document.id }).get()).status).toBe(403);

    await owner.api.projects.post({ key: 'OPS', name: 'Operations' });
    expect((await documents(owner.api, 'OPS')({ documentId: document.id }).get()).status).toBe(404);
  });

  it('validates document fields and returns 404 for missing documents', async () => {
    const { api } = await setupOwnerProject();
    expect((await documents(api).post({ title: 'x'.repeat(256) })).status).toBe(400);
    expect(
      (
        await documents(api).post({
          title: 'Oversized metadata',
          metadata: { value: 'x'.repeat(17_000) },
        })
      ).status,
    ).toBe(400);
    expect((await documents(api).post({ title: 'Invalid', parentId: 999_999 })).status).toBe(400);
    const document = (await documents(api).post({ title: 'Valid' })).data!;
    expect(
      (
        await documents(api)({ documentId: document.id }).patch({
          version: 0,
          title: 'Invalid',
        })
      ).status,
    ).toBe(400);
    expect(
      (await documents(api)({ documentId: 999_999 }).patch({ version: 1, title: 'Missing' }))
        .status,
    ).toBe(404);
    expect(
      (await documents(api)({ documentId: 999_999 }).delete({}, { query: { version: 1 } })).status,
    ).toBe(404);
  });

  it('copies document content and remaps the document tree', async () => {
    const { api } = await setupOwnerProject();
    const root = (await documents(api).post({ title: 'Runbook' })).data!;
    await documents(api)({ documentId: root.id }).patch({
      version: root.version,
      content: 'Source content',
    });
    const child = (await documents(api).post({ title: 'Deploy', parentId: root.id })).data!;

    expect(
      (await api.projects({ projectKey: 'MKT' }).copy.post({ key: 'CPY', name: 'Copy' })).status,
    ).toBe(201);
    const copied = await documents(api, 'CPY').get({ query: {} });
    expect(copied.status).toBe(200);
    expect(copied.data).toHaveLength(2);
    const copiedRoot = copied.data!.find((document) => document.title === 'Runbook')!;
    const copiedChild = copied.data!.find((document) => document.title === 'Deploy')!;
    expect(copiedRoot.id).not.toBe(root.id);
    expect(copiedChild.id).not.toBe(child.id);
    expect(copiedChild.parentId).toBe(copiedRoot.id);
    expect((await documents(api, 'CPY')({ documentId: copiedRoot.id }).get()).data).toMatchObject({
      content: 'Source content',
      version: 1,
    });
    const copiedChildHistory = await documents(
      api,
      'CPY',
    )({
      documentId: copiedChild.id,
    }).revisions.get();
    expect(copiedChildHistory.data?.map((revision) => revision.version)).toEqual([1]);
    expect(
      (
        await documents(
          api,
          'CPY',
        )({ documentId: copiedChild.id })
          .revisions({ revisionId: copiedChildHistory.data![0]!.id })
          .get()
      ).data?.parentId,
    ).toBe(copiedRoot.id);
  });

  it('stores every revision and restores history as a new optimistic version', async () => {
    const { api } = await setupOwnerProject();
    const created = (
      await documents(api).post({
        title: 'Runbook',
        content: 'Version one',
        icon: '📘',
        metadata: { audience: 'ops' },
        fullWidth: true,
      })
    ).data!;
    const updated = await documents(api)({ documentId: created.id }).patch({
      version: 1,
      title: 'Release runbook',
      content: 'Version two',
      metadata: { audience: 'engineering' },
    });
    expect(updated.status).toBe(200);

    const revisions = await documents(api)({ documentId: created.id }).revisions.get();
    expect(revisions.status).toBe(200);
    expect(revisions.data?.map((revision) => revision.version)).toEqual([2, 1]);
    const firstRevision = revisions.data!.find((revision) => revision.version === 1)!;
    const snapshot = await documents(api)({ documentId: created.id })
      .revisions({ revisionId: firstRevision.id })
      .get();
    expect(snapshot.data).toMatchObject({
      title: 'Runbook',
      content: 'Version one',
      metadata: { audience: 'ops' },
      fullWidth: true,
    });

    const restored = await documents(api)({ documentId: created.id })
      .revisions({ revisionId: firstRevision.id })
      .restore.post({ version: 2 });
    expect(restored.status).toBe(200);
    expect(restored.data).toMatchObject({
      title: 'Runbook',
      content: 'Version one',
      version: 3,
    });
    expect(
      (
        await documents(api)({ documentId: created.id })
          .revisions({ revisionId: firstRevision.id })
          .restore.post({ version: 2 })
      ).status,
    ).toBe(409);
    expect(
      (await documents(api)({ documentId: created.id }).revisions.get()).data?.map(
        (revision) => revision.version,
      ),
    ).toEqual([3, 2, 1]);
  });

  it('archives a tree and restores a child at the root when its parent stays archived', async () => {
    const { api } = await setupOwnerProject();
    const root = (await documents(api).post({ title: 'Root' })).data!;
    const child = (await documents(api).post({ title: 'Child', parentId: root.id })).data!;
    const grandchild = (await documents(api).post({ title: 'Grandchild', parentId: child.id }))
      .data!;

    const archived = await documents(api)({ documentId: root.id }).archive.post({ version: 1 });
    expect(archived.status).toBe(200);
    expect(archived.data).toMatchObject({ archivedAt: expect.any(Date), version: 2 });
    expect((await documents(api).get({ query: {} })).data).toEqual([]);
    expect(
      (await documents(api).get({ query: { archived: 'true' } })).data?.map(
        (document) => document.id,
      ),
    ).toEqual([root.id, child.id, grandchild.id]);
    expect((await documents(api).post({ title: 'Invalid', parentId: root.id })).status).toBe(400);

    const restored = await documents(api)({ documentId: child.id }).restore.post({ version: 2 });
    expect(restored.status).toBe(200);
    expect(restored.data).toMatchObject({ parentId: null, archivedAt: null, version: 3 });
    expect((await documents(api)({ documentId: grandchild.id }).get()).data).toMatchObject({
      parentId: child.id,
      archivedAt: null,
      version: 3,
    });
    expect((await documents(api)({ documentId: root.id }).get()).data?.archivedAt).not.toBeNull();
  });

  it('restores only descendants archived by the same tree operation', async () => {
    const { api } = await setupOwnerProject();
    const root = (await documents(api).post({ title: 'Root' })).data!;
    const independentlyArchived = (
      await documents(api).post({ title: 'Independent', parentId: root.id })
    ).data!;
    const independentChild = (
      await documents(api).post({ title: 'Independent child', parentId: independentlyArchived.id })
    ).data!;
    const cascaded = (await documents(api).post({ title: 'Cascaded', parentId: root.id })).data!;

    const archivedIndependent = await documents(api)({
      documentId: independentlyArchived.id,
    }).archive.post({ version: independentlyArchived.version });
    expect(archivedIndependent.status).toBe(200);
    const archivedRoot = await documents(api)({ documentId: root.id }).archive.post({
      version: root.version,
    });
    const restoredRoot = await documents(api)({ documentId: root.id }).restore.post({
      version: archivedRoot.data!.version,
    });

    expect(restoredRoot.status).toBe(200);
    expect((await documents(api)({ documentId: cascaded.id }).get()).data).toMatchObject({
      archivedAt: null,
      parentId: root.id,
    });
    expect(
      (await documents(api)({ documentId: independentlyArchived.id }).get()).data?.archivedAt,
    ).not.toBeNull();
    expect(
      (await documents(api)({ documentId: independentChild.id }).get()).data?.archivedAt,
    ).not.toBeNull();
  });

  it('uses optimistic versions for archive, restore, and permanent delete', async () => {
    const { api } = await setupOwnerProject();
    const page = (await documents(api).post({ title: 'Lifecycle' })).data!;
    const updated = await documents(api)({ documentId: page.id }).patch({
      version: 1,
      content: 'Current',
    });
    expect(
      (
        await documents(api)({ documentId: page.id }).archive.post({
          version: 1,
        })
      ).status,
    ).toBe(409);
    const archived = await documents(api)({ documentId: page.id }).archive.post({ version: 2 });
    expect(archived.data?.version).toBe(3);
    expect(
      (
        await documents(api)({ documentId: page.id }).restore.post({
          version: 2,
        })
      ).status,
    ).toBe(409);
    const restored = await documents(api)({ documentId: page.id }).restore.post({ version: 3 });
    expect(restored.data?.version).toBe(4);
    expect(
      (
        await documents(api)({ documentId: page.id }).delete(
          {},
          { query: { version: restored.data!.version } },
        )
      ).status,
    ).toBe(409);
    expect(updated.data?.content).toBe('Current');
  });

  it('does not archive a private descendant that the page owner cannot see', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    const root = (await documents(owner.api).post({ title: 'Shared root' })).data!;
    const privateChild = (
      await documents(member.api).post({
        title: 'Member private child',
        parentId: root.id,
        isPrivate: true,
      })
    ).data!;

    expect(
      (
        await documents(owner.api)({ documentId: root.id }).archive.post({
          version: root.version,
        })
      ).status,
    ).toBe(200);
    expect((await documents(owner.api)({ documentId: privateChild.id }).get()).status).toBe(404);
    expect((await documents(member.api)({ documentId: privateChild.id }).get()).data).toMatchObject(
      {
        archivedAt: null,
        parentId: root.id,
      },
    );
    expect((await documents(member.api).get({ query: {} })).data).toMatchObject([
      { id: privateChild.id, parentId: null },
    ]);
  });

  it('keeps private pages owner-only without leaking their existence', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    const page = (
      await documents(owner.api).post({
        title: 'Private plan',
        content: 'Secret',
        isPrivate: true,
      })
    ).data!;
    expect(page).toMatchObject({ isPrivate: true, ownerUserId: owner.userId });
    expect((await documents(member.api).get({ query: {} })).data).toEqual([]);
    expect((await documents(member.api)({ documentId: page.id }).get()).status).toBe(404);
    expect(
      (
        await documents(member.api)({ documentId: page.id }).duplicate.post({
          version: page.version,
        })
      ).status,
    ).toBe(404);

    const publicPage = await documents(owner.api)({ documentId: page.id }).access.post({
      version: page.version,
      isPrivate: false,
    });
    expect(publicPage.data).toMatchObject({ isPrivate: false, version: 2 });
    expect(
      (
        await documents(owner.api)({ documentId: page.id }).access.post({
          version: 1,
          isPrivate: true,
        })
      ).status,
    ).toBe(409);
    expect((await documents(member.api)({ documentId: page.id }).get()).status).toBe(200);
    expect(
      (
        await documents(member.api)({ documentId: page.id }).access.post({
          version: 2,
          isPrivate: true,
        })
      ).status,
    ).toBe(403);

    const ownerHistory = await documents(owner.api)({ documentId: page.id }).revisions.get();
    const memberHistory = await documents(member.api)({ documentId: page.id }).revisions.get();
    expect(ownerHistory.data?.map((revision) => revision.version)).toEqual([2, 1]);
    expect(memberHistory.data?.map((revision) => revision.version)).toEqual([2]);

    const privateRevision = ownerHistory.data!.find((revision) => revision.version === 1)!;
    const restoredPrivate = await documents(owner.api)({ documentId: page.id })
      .revisions({ revisionId: privateRevision.id })
      .restore.post({ version: publicPage.data!.version });
    expect(restoredPrivate.data).toMatchObject({
      content: 'Secret',
      isPrivate: true,
      ownerUserId: owner.userId,
    });
    expect((await documents(member.api)({ documentId: page.id }).get()).status).toBe(404);
  });

  it('hides a private parent from public child details and history', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    const parent = (await documents(owner.api).post({ title: 'Initially shared' })).data!;
    const child = (await documents(member.api).post({ title: 'Public child', parentId: parent.id }))
      .data!;
    const privateParent = await documents(owner.api)({ documentId: parent.id }).access.post({
      version: parent.version,
      isPrivate: true,
    });
    expect(privateParent.status).toBe(200);

    expect((await documents(member.api).get({ query: {} })).data).toMatchObject([
      { id: child.id, parentId: null },
    ]);
    expect((await documents(member.api)({ documentId: child.id }).get()).data).toMatchObject({
      id: child.id,
      parentId: null,
    });
    const revisions = await documents(member.api)({ documentId: child.id }).revisions.get();
    const snapshot = await documents(member.api)({ documentId: child.id })
      .revisions({ revisionId: revisions.data![0]!.id })
      .get();
    expect(snapshot.data).toMatchObject({ documentId: child.id, parentId: null });
  });

  it('enforces locks and keeps favorites personal', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    const page = (await documents(owner.api).post({ title: 'Handbook' })).data!;

    const locked = await documents(owner.api)({ documentId: page.id }).lock.post({ version: 1 });
    expect(locked.data).toMatchObject({ isLocked: true, version: 2 });
    expect(
      (
        await documents(owner.api)({ documentId: page.id }).patch({
          version: 2,
          content: 'Blocked',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await documents(owner.api)({ documentId: page.id }).unlock.post({
          version: 1,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await documents(member.api)({ documentId: page.id }).unlock.post({
          version: 2,
        })
      ).status,
    ).toBe(403);
    const unlocked = await documents(owner.api)({ documentId: page.id }).unlock.post({
      version: 2,
    });
    expect(unlocked.data).toMatchObject({ isLocked: false, version: 3 });

    expect(
      (
        await documents(owner.api)({ documentId: page.id }).preferences.patch({
          isFavorite: true,
        })
      ).data,
    ).toEqual({ isFavorite: true });
    expect((await documents(owner.api)({ documentId: page.id }).get()).data?.isFavorite).toBe(true);
    expect((await documents(member.api)({ documentId: page.id }).get()).data?.isFavorite).toBe(
      false,
    );
    await documents(member.api)({ documentId: page.id }).preferences.patch({ isFavorite: true });
    expect((await documents(member.api)({ documentId: page.id }).get()).data?.isFavorite).toBe(
      true,
    );
    const saved = await documents(owner.api)({ documentId: page.id }).patch({
      version: 3,
      content: 'Favorite stays favorite',
    });
    expect(saved.data).toMatchObject({ version: 4, isFavorite: true });
  });

  it('duplicates appearance and exports stable Markdown without accepting a stale source', async () => {
    const { api } = await setupOwnerProject();
    const page = (
      await documents(api).post({
        title: 'Release/Guide?',
        content: '# Ship it',
        icon: '🚀',
        metadata: { owner: 'platform' },
        fullWidth: true,
      })
    ).data!;
    const updated = await documents(api)({ documentId: page.id }).patch({
      version: 1,
      content: '# Ship safely',
    });
    expect(
      (
        await documents(api)({ documentId: page.id }).duplicate.post({
          version: 1,
        })
      ).status,
    ).toBe(409);
    const duplicate = await documents(api)({ documentId: page.id }).duplicate.post({
      version: updated.data!.version,
    });
    expect(duplicate.status).toBe(201);
    expect(duplicate.data).toMatchObject({
      title: 'Release/Guide? (Copy)',
      content: '# Ship safely',
      icon: '🚀',
      metadata: { owner: 'platform' },
      fullWidth: true,
      version: 1,
    });

    const exported = await documents(api)({ documentId: page.id }).export.get();
    expect(exported.data).toMatchObject({
      filename: 'Release-Guide-.md',
      mimeType: 'text/markdown',
      content: '# Ship safely',
      version: 2,
    });
  });

  it('omits another member private pages when a project is copied', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    await documents(owner.api).post({ title: 'Shared' });
    await documents(member.api).post({ title: 'Member secret', isPrivate: true });
    await documents(owner.api).post({
      title: 'Owner private',
      isPrivate: true,
      icon: '🔒',
      metadata: { copied: true },
      fullWidth: true,
    });

    expect(
      (await owner.api.projects({ projectKey: 'MKT' }).copy.post({ key: 'CPY', name: 'Copy' }))
        .status,
    ).toBe(201);
    const copied = await documents(owner.api, 'CPY').get({ query: {} });
    expect(copied.data?.map((document) => document.title).sort()).toEqual([
      'Owner private',
      'Shared',
    ]);
    expect(copied.data?.find((document) => document.title === 'Owner private')).toMatchObject({
      isPrivate: true,
      ownerUserId: owner.userId,
      icon: '🔒',
      metadata: { copied: true },
      fullWidth: true,
    });
  });

  it('lets project owners administer public pages and recover ownership without exposing private pages', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    const publicPage = (await documents(member.api).post({ title: 'Team handbook' })).data!;
    const privatePage = (
      await documents(member.api).post({ title: 'Private draft', isPrivate: true })
    ).data!;

    expect(
      (
        await documents(owner.api)({ documentId: publicPage.id }).access.post({
          version: publicPage.version,
          isPrivate: true,
        })
      ).status,
    ).toBe(403);

    const locked = await documents(owner.api)({ documentId: publicPage.id }).lock.post({
      version: publicPage.version,
    });
    expect(locked.data).toMatchObject({ isLocked: true, version: 2 });
    const unlocked = await documents(owner.api)({ documentId: publicPage.id }).unlock.post({
      version: locked.data!.version,
    });
    const archived = await documents(owner.api)({ documentId: publicPage.id }).archive.post({
      version: unlocked.data!.version,
    });
    const restored = await documents(owner.api)({ documentId: publicPage.id }).restore.post({
      version: archived.data!.version,
    });
    expect(restored.status).toBe(200);

    expect(
      (
        await documents(owner.api)({ documentId: privatePage.id }).lock.post({
          version: privatePage.version,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await documents(owner.api)({ documentId: privatePage.id }).ownership.post({
          version: privatePage.version,
          ownerUserId: owner.userId,
        })
      ).status,
    ).toBe(404);

    const formerlyPrivate = (
      await documents(member.api).post({
        title: 'Formerly private',
        content: 'Original owner secret',
        isPrivate: true,
      })
    ).data!;
    const privateRevision = (
      await documents(member.api)({ documentId: formerlyPrivate.id }).revisions.get()
    ).data![0]!;
    const published = await documents(member.api)({ documentId: formerlyPrivate.id }).access.post({
      version: formerlyPrivate.version,
      isPrivate: false,
    });
    const transferred = await documents(owner.api)({
      documentId: formerlyPrivate.id,
    }).ownership.post({
      version: published.data!.version,
      ownerUserId: owner.userId,
    });
    expect(transferred.data).toMatchObject({ ownerUserId: owner.userId, version: 3 });
    expect(
      (
        await documents(owner.api)({ documentId: formerlyPrivate.id })
          .revisions({ revisionId: privateRevision.id })
          .get()
      ).status,
    ).toBe(404);
    expect(
      (
        await documents(member.api)({ documentId: formerlyPrivate.id })
          .revisions({ revisionId: privateRevision.id })
          .restore.post({ version: transferred.data!.version })
      ).status,
    ).toBe(403);
    expect(
      (await documents(member.api)({ documentId: formerlyPrivate.id }).get()).data,
    ).toMatchObject({ isPrivate: false, ownerUserId: owner.userId, version: 3 });
    expect(
      (
        await documents(owner.api)({ documentId: formerlyPrivate.id })
          .revisions({ revisionId: privateRevision.id })
          .restore.post({ version: transferred.data!.version })
      ).status,
    ).toBe(404);
    expect(
      (await documents(owner.api)({ documentId: formerlyPrivate.id }).revisions.get()).data?.map(
        (revision) => revision.version,
      ),
    ).toEqual([3, 2]);

    const outsider = await signUpTestUser();
    expect(
      (
        await documents(owner.api)({ documentId: publicPage.id }).ownership.post({
          version: restored.data!.version,
          ownerUserId: outsider.userId,
        })
      ).status,
    ).toBe(400);
    await owner.api.projects({ projectKey: 'MKT' }).members({ userId: member.userId }).delete();
    const claimed = await documents(owner.api)({ documentId: publicPage.id }).ownership.post({
      version: restored.data!.version,
      ownerUserId: owner.userId,
    });
    expect(claimed.data).toMatchObject({ ownerUserId: owner.userId });
    expect(
      (
        await documents(owner.api)({ documentId: publicPage.id }).ownership.post({
          version: restored.data!.version,
          ownerUserId: owner.userId,
        })
      ).status,
    ).toBe(409);
  });

  it('preserves rich JSON through history restore, duplicate, and project copy', async () => {
    const owner = await setupOwnerProject();
    const member = await addMember(owner.api);
    const firstJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Red', marks: [{ type: 'textStyle', attrs: { color: '#f00' } }] },
          ],
        },
      ],
    };
    const secondJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'Centered',
              marks: [{ type: 'highlight', attrs: { color: '#fef08a' } }],
            },
          ],
        },
      ],
    };
    const page = (
      await documents(owner.api).post({
        title: 'Rich page',
        content: 'Red',
        contentJson: firstJson,
      })
    ).data!;
    const edited = await documents(member.api)({ documentId: page.id }).patch({
      version: 1,
      content: 'Centered',
      contentJson: secondJson,
    });
    expect(edited.data?.contentJson).toEqual(secondJson);
    const revisions = await documents(owner.api)({ documentId: page.id }).revisions.get();
    expect(revisions.data?.map((revision) => revision.version)).toEqual([2, 1]);
    const firstRevision = revisions.data!.find((revision) => revision.version === 1)!;
    expect(
      (
        await documents(owner.api)({ documentId: page.id })
          .revisions({ revisionId: firstRevision.id })
          .get()
      ).data?.contentJson,
    ).toEqual(firstJson);
    const restored = await documents(owner.api)({ documentId: page.id })
      .revisions({ revisionId: firstRevision.id })
      .restore.post({ version: edited.data!.version });
    expect(restored.data?.contentJson).toEqual(firstJson);

    const duplicate = await documents(owner.api)({ documentId: page.id }).duplicate.post({
      version: restored.data!.version,
    });
    expect(duplicate.data?.contentJson).toEqual(firstJson);
    await owner.api.projects({ projectKey: 'MKT' }).copy.post({ key: 'CPY', name: 'Copy' });
    const copied = await documents(owner.api, 'CPY').get({ query: {} });
    const copiedPage = copied.data!.find((document) => document.title === 'Rich page')!;
    expect(
      (await documents(owner.api, 'CPY')({ documentId: copiedPage.id }).get()).data?.contentJson,
    ).toEqual(firstJson);

    expect(
      (
        await documents(owner.api).post({
          title: 'Invalid JSON',
          contentJson: { type: 'doc', content: [{ type: 'unknownWidget' }] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await documents(owner.api).post({
          title: 'Invalid mark',
          contentJson: {
            type: 'doc',
            content: [{ type: 'text', text: 'Bad', marks: [{ type: 'unknownMark' }] }],
          },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await documents(owner.api).post({
          title: 'Invalid highlight',
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'text',
                text: 'Bad',
                marks: [{ type: 'highlight', attrs: { color: 'url(javascript:alert(1))' } }],
              },
            ],
          },
        })
      ).status,
    ).toBe(400);
  });

  it('accepts safe rich-content attrs and rejects executable or malformed attrs', async () => {
    const { api } = await setupOwnerProject();
    const assetId = '11111111-1111-4111-8111-111111111111';
    const safeJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'right' },
          content: [{ type: 'text', text: 'Safe rich content' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'External',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://example.com/docs',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: 'docs-link',
                  },
                },
                { type: 'textStyle', attrs: { color: '#abcdef' } },
                { type: 'highlight', attrs: { color: '#fff' } },
              ],
            },
            { type: 'text', text: 'Relative', marks: [{ type: 'link', attrs: { href: '/docs' } }] },
            { type: 'text', text: 'Anchor', marks: [{ type: 'link', attrs: { href: '#part' } }] },
            {
              type: 'text',
              text: 'Mail',
              marks: [{ type: 'link', attrs: { href: 'mailto:docs@example.com' } }],
            },
            { type: 'text', text: 'Phone', marks: [{ type: 'link', attrs: { href: 'tel:+123' } }] },
          ],
        },
        {
          type: 'image',
          attrs: {
            src: `/protected-media/projects/MKT/documents/1/assets/${assetId}/raw`,
            alt: 'Architecture',
            title: 'Architecture diagram',
            width: 640,
            style: 'max-width: 100%;',
          },
        },
        {
          type: 'image',
          attrs: { src: `/projects/MKT/documents/1/assets/${assetId}/raw` },
        },
        { type: 'image', attrs: { src: 'https://example.com/diagram.png' } },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: [240] },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header' }] }],
                },
                {
                  type: 'tableCell',
                  attrs: { colspan: 2, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect((await documents(api).post({ title: 'Safe attrs', contentJson: safeJson })).status).toBe(
      201,
    );

    const withMark = (mark: Record<string, unknown>) => ({
      type: 'doc',
      content: [{ type: 'text', text: 'Unsafe', marks: [mark] }],
    });
    const withNode = (node: Record<string, unknown>) => ({ type: 'doc', content: [node] });
    const invalidJson = [
      withMark({ type: 'link', attrs: { href: 'javascript:alert(1)' } }),
      withMark({ type: 'link', attrs: { href: 'data:text/html,unsafe' } }),
      withMark({ type: 'link', attrs: { href: 'vbscript:msgbox(1)' } }),
      withMark({ type: 'link', attrs: { href: ' javascript:alert(1)' } }),
      withMark({ type: 'link', attrs: { href: 'java\nscript:alert(1)' } }),
      withMark({ type: 'link', attrs: { href: 'java\u0000script:alert(1)' } }),
      withMark({ type: 'link', attrs: { href: 'java\u200bscript:alert(1)' } }),
      withMark({ type: 'link', attrs: { href: '//evil.example/path' } }),
      withMark({ type: 'link', attrs: { href: 'https://user:pass@example.com' } }),
      withMark({ type: 'link', attrs: { href: 'https://example.com', onclick: 'alert(1)' } }),
      withNode({ type: 'image', attrs: { src: 'data:image/svg+xml,unsafe' } }),
      withNode({ type: 'image', attrs: { src: 'javascript:alert(1)' } }),
      withNode({
        type: 'image',
        attrs: { src: `/media/projects/MKT/documents/1/assets/${assetId}/raw` },
      }),
      withNode({ type: 'image', attrs: { src: '//evil.example/image.png' } }),
      withNode({
        type: 'image',
        attrs: { src: 'https://example.com/image.png', onerror: 'alert(1)' },
      }),
      withNode({
        type: 'image',
        attrs: { src: 'https://example.com/image.png', alt: 'x'.repeat(1_001) },
      }),
      withNode({
        type: 'image',
        attrs: { src: 'https://example.com/image.png', style: 'position:fixed' },
      }),
      withNode({ type: 'heading', attrs: { level: 0 } }),
      withNode({ type: 'heading', attrs: { level: 7 } }),
      withNode({ type: 'heading', attrs: { level: 2, textAlign: 'justify' } }),
      withNode({ type: 'paragraph', attrs: { textAlign: 'justify' } }),
      withNode({ type: 'taskItem', attrs: { checked: 'true' } }),
      withNode({ type: 'tableCell', attrs: { colspan: 0 } }),
      withNode({ type: 'tableHeader', attrs: { rowspan: 101 } }),
      withNode({ type: 'tableCell', attrs: { colwidth: [] } }),
      withNode({ type: 'tableCell', attrs: { colwidth: [0] } }),
      withMark({ type: 'textStyle', attrs: { color: 'rgb(255, 0, 0)' } }),
      withMark({ type: 'highlight', attrs: { color: '#12' } }),
      withMark({ type: 'highlight', attrs: { color: '#12345' } }),
    ];
    for (const contentJson of invalidJson) {
      expect((await documents(api).post({ title: 'Unsafe attrs', contentJson })).status).toBe(400);
    }
  });

  it('coalesces autosaves and retains at most twenty useful revisions', async () => {
    const { api } = await setupOwnerProject();
    const page = (await documents(api).post({ title: 'Autosave' })).data!;
    let version = page.version;
    for (let index = 0; index < 3; index += 1) {
      const updated = await documents(api)({ documentId: page.id }).patch({
        version,
        content: `Draft ${index}`,
        contentJson: { type: 'doc', content: [{ type: 'text', text: `Draft ${index}` }] },
      });
      version = updated.data!.version;
    }
    expect(
      (await documents(api)({ documentId: page.id }).revisions.get()).data?.map(
        (revision) => revision.version,
      ),
    ).toEqual([version, 1]);

    for (let index = 0; index < 24; index += 1) {
      const updated = await documents(api)({ documentId: page.id }).patch({
        version,
        fullWidth: index % 2 === 0,
      });
      version = updated.data!.version;
    }
    const retained = await documents(api)({ documentId: page.id }).revisions.get();
    expect(retained.data).toHaveLength(20);
    expect(retained.data?.[0].version).toBe(version);
    expect(retained.data?.at(-1)!.version).toBe(version - 19);
  });
});
