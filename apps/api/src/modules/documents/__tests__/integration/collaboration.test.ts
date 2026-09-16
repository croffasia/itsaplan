import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const contentJson = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
};
async function setup() {
  const owner = await signUpTestUser();
  const client = authedApi(owner.cookie);
  await client.projects.post({ key: 'DOC', name: 'Documents' });
  const routes = client.projects({ projectKey: 'DOC' }).documents;
  const created = await routes.post({ title: 'Shared', content: 'Hello world', contentJson });
  const doc = routes({ documentId: created.data!.id });
  const opened = await doc.session.post({ version: created.data!.version, contentJson });
  expect(opened.status).toBe(200);
  return { client, doc, id: created.data!.id, session: opened.data! };
}
const insert = (from: number, text: string) => ({
  stepType: 'replace',
  from,
  to: from,
  slice: { content: [{ type: 'text', text }] },
});

describe('collaborative documents', () => {
  beforeEach(resetDb);
  it('accepts ordered changes, rejects stale writers, and exposes steps for rebasing', async () => {
    const { doc, session } = await setup();
    const first = await doc.steps.post({
      epoch: session.epoch,
      version: 0,
      clientId: 'alice',
      steps: [insert(1, 'A')],
      content: 'AHello world',
    });
    expect(first.status).toBe(200);
    expect(
      (
        await doc.steps.post({
          epoch: session.epoch,
          version: 0,
          clientId: 'bob',
          steps: [insert(1, 'B')],
          content: 'BHello world',
        })
      ).status,
    ).toBe(409);
    const changes = await doc.steps.get({ query: { epoch: session.epoch, version: 0 } });
    expect(changes.data).toMatchObject({
      version: 1,
      hasMore: false,
      steps: [{ clientId: 'alice' }],
    });
    expect(
      (
        await doc.steps.post({
          epoch: session.epoch,
          version: 1,
          clientId: 'bob',
          steps: [insert(2, 'B')],
          content: 'ABHello world',
        })
      ).status,
    ).toBe(200);
    expect((await doc.get()).data!.contentJson).toMatchObject({
      content: [{ content: [{ text: 'ABHello world' }] }],
    });
    expect((await doc.revisions.get()).data!.length).toBeGreaterThan(1);
  });
  it('keeps a session across title changes but refuses replaced content and locked pages', async () => {
    const { doc, session } = await setup();
    let current = (await doc.get()).data!;
    expect((await doc.patch({ version: current.version, title: 'Renamed' })).status).toBe(200);
    expect(
      (
        await doc.steps.post({
          epoch: session.epoch,
          version: 0,
          clientId: 'alice',
          steps: [insert(1, 'A')],
          content: 'AHello world',
        })
      ).status,
    ).toBe(200);
    current = (await doc.get()).data!;
    await doc.lock.post({ version: current.version });
    expect(
      (
        await doc.steps.post({
          epoch: session.epoch,
          version: 1,
          clientId: 'alice',
          steps: [insert(1, 'B')],
          content: 'BAHello world',
        })
      ).status,
    ).toBe(409);
  });
  it('reopens rich content with the exact attributes emitted by the editor', async () => {
    const { doc } = await setup();
    const paragraph = {
      type: 'paragraph',
      attrs: { blockId: 'paragraph', textAlign: null },
      content: [
        {
          type: 'text',
          text: 'Linked',
          marks: [
            {
              type: 'link',
              attrs: {
                href: '/project/DOC',
                target: '_blank',
                rel: 'noopener noreferrer nofollow',
                class: null,
                title: null,
              },
            },
          ],
        },
      ],
    };
    const rich = {
      type: 'doc',
      content: [
        paragraph,
        {
          type: 'bulletList',
          attrs: { blockId: 'bullet', tight: true },
          content: [{ type: 'listItem', content: [paragraph] }],
        },
        {
          type: 'orderedList',
          attrs: { blockId: 'ordered', tight: true, start: 1, type: null },
          content: [{ type: 'listItem', content: [paragraph] }],
        },
        {
          type: 'image',
          attrs: {
            blockId: 'image',
            src: 'https://example.com/image.png',
            alt: null,
            title: null,
            width: null,
            style: null,
          },
        },
        {
          type: 'table',
          attrs: { blockId: 'table' },
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
                  content: [paragraph],
                },
              ],
            },
          ],
        },
      ],
    };
    const current = (await doc.get()).data!;
    const replaced = await doc.patch({
      version: current.version,
      content: 'Linked',
      contentJson: rich,
    });
    expect(replaced.status).toBe(200);
    const first = await doc.session.post({ version: replaced.data!.version, contentJson: rich });
    expect(first.status).toBe(200);
    const second = await doc.session.post({
      version: replaced.data!.version,
      contentJson: first.data!.contentJson,
    });
    expect(second.status).toBe(200);
    expect(second.data!.epoch).toBe(first.data!.epoch);
    expect(
      (
        await doc.steps.post({
          epoch: first.data!.epoch,
          version: 0,
          clientId: 'rich',
          steps: [insert(1, 'A')],
          content: 'ALinked',
        })
      ).status,
    ).toBe(200);
  });
  it('invalidates active sessions on Markdown-only replacement', async () => {
    const { doc, session } = await setup();
    const current = (await doc.get()).data!;
    expect((await doc.patch({ version: current.version, content: 'Replacement' })).status).toBe(
      200,
    );
    expect((await doc.get()).data!.contentJson).toBeNull();
    expect((await doc.steps.get({ query: { epoch: session.epoch, version: 0 } })).status).toBe(409);
  });
  it('rejects invalid structures, links and out-of-bounds transformations', async () => {
    const { doc, session } = await setup();
    const invalid = [insert(99999, 'bad')];
    expect(
      (
        await doc.steps.post({
          epoch: session.epoch,
          version: 0,
          clientId: 'bad',
          steps: invalid,
          content: 'bad',
        })
      ).status,
    ).toBe(400);
    const link = {
      stepType: 'addMark',
      from: 1,
      to: 4,
      mark: { type: 'link', attrs: { href: 'javascript:alert(1)' } },
    };
    expect(
      (
        await doc.steps.post({
          epoch: session.epoch,
          version: 0,
          clientId: 'bad',
          steps: [link],
          content: 'bad',
        })
      ).status,
    ).toBe(400);
    expect(
      (await doc.steps.get({ query: { epoch: session.epoch, version: 0 } })).data!.version,
    ).toBe(0);
  });
  it('anchors discussions, maps selections through edits and preserves removed quotations', async () => {
    const { doc, session } = await setup();
    const version = (await doc.get()).data!.version;
    const comment = await doc.comments.post({
      body: 'Please clarify',
      quote: 'Hello',
      from: 1,
      to: 6,
      version,
    });
    expect(comment.status).toBe(201);
    expect(
      (await doc.comments.post({ body: 'Invalid', quote: 'Other', from: 1, to: 6, version }))
        .status,
    ).toBe(409);
    await doc.steps.post({
      epoch: session.epoch,
      version: 0,
      clientId: 'alice',
      steps: [insert(1, 'A')],
      content: 'AHello world',
    });
    expect((await doc.comments.get()).data![0]).toMatchObject({ from: 2, to: 7, orphaned: false });
    await doc.steps.post({
      epoch: session.epoch,
      version: 1,
      clientId: 'alice',
      steps: [{ stepType: 'replace', from: 2, to: 7 }],
      content: 'A world',
    });
    expect((await doc.comments.get()).data![0]).toMatchObject({ quote: 'Hello', orphaned: true });
    const reply = await doc.comments.post({ parentId: comment.data!.id, body: 'Agreed', version });
    expect(reply.status).toBe(201);
    expect(
      (await doc.comments({ commentId: comment.data!.id }).patch({ resolved: true })).status,
    ).toBe(200);
    expect((await doc.comments.get()).data![0].resolvedAt).not.toBeNull();
  });
  it('refuses non-members and does not expose private document sessions or comments', async () => {
    const { client, doc, id, session } = await setup();
    const stranger = await signUpTestUser();
    const outsider = authedApi(stranger.cookie);
    const other = outsider.projects({ projectKey: 'DOC' }).documents({ documentId: id });
    expect((await other.steps.get({ query: { epoch: session.epoch, version: 0 } })).status).toBe(
      403,
    );
    const invite = await client
      .projects({ projectKey: 'DOC' })
      .invites.post({ email: stranger.email, role: 'member' });
    await outsider.invites({ token: invite.data!.token }).accept.post();
    const current = (await doc.get()).data!;
    await doc.access.post({ version: current.version, isPrivate: true });
    expect((await other.comments.get()).status).toBe(404);
    expect((await other.session.post({ version: current.version, contentJson })).status).toBe(404);
  });
});
