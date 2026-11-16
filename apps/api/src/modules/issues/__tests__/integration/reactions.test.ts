import { describe, it, expect, beforeEach } from 'bun:test';
import { auth } from '@repo/auth';
import { db, notification, notificationDelivery } from '@repo/db';
import { eq } from 'drizzle-orm';
import { api, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { mcpRpc } from '#tests/helpers/mcp';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';
import { MAX_COMMENT_EMOJI } from '../../reactions';

// Emoji reactions on a comment: POST /comments/:commentId/reactions adds the caller's,
// DELETE /comments/:commentId/reactions/:emoji removes it, and the feed serves the
// reactions of each comment with it. A new reaction sends the comment's author a
// 'reacted' notification.

interface Setup {
  asOwner: Api;
  owner: TestUser;
  issueId: number;
  commentId: number;
}

async function setup(): Promise<Setup> {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const issue = await asOwner
    .projects({ projectKey: 'MKT' })
    .issues.post({ columnId: view.data!.columns[0].id, title: 'Task' });
  const comment = await asOwner.issues({ issueId: issue.data!.id }).comments.post({ body: 'note' });
  return { asOwner, owner, issueId: issue.data!.id, commentId: comment.data!.id };
}

function react(client: Api, commentId: number, emoji: string) {
  return client.comments({ commentId }).reactions.post({ emoji });
}

function unreact(client: Api, commentId: number, emoji: string) {
  return client.comments({ commentId }).reactions({ emoji }).delete();
}

// The reactions the feed serves for one comment.
async function feedReactions(client: Api, issueId: number, commentId: number) {
  const res = await client.issues({ issueId }).feed.get({ query: {} });
  return res.data!.items.find((item) => item.id === commentId)!.reactions;
}

describe('comment reactions', () => {
  beforeEach(resetDb);

  it('adds a reaction and serves it with the comment in the feed', async () => {
    const { asOwner, owner, issueId, commentId } = await setup();

    const res = await react(asOwner, commentId, '👍');
    expect(res.status).toBe(201);
    const expected = [{ emoji: '👍', users: [{ id: owner.userId, name: 'Owner' }] }];
    expect(res.data).toEqual(expected);
    expect(await feedReactions(asOwner, issueId, commentId)).toEqual(expected);
  });

  it('serves a comment without reactions, and a change-log entry, with an empty list', async () => {
    const { asOwner, issueId } = await setup();
    const res = await asOwner.issues({ issueId }).feed.get({ query: {} });
    expect(res.data!.items.map((item) => item.reactions)).toEqual([[], []]);
  });

  it('keeps one reaction when the same member adds the same emoji twice', async () => {
    const { asOwner, commentId } = await setup();
    await react(asOwner, commentId, '👍');

    const res = await react(asOwner, commentId, '👍');
    expect(res.status).toBe(201);
    expect(res.data).toHaveLength(1);
    expect(res.data![0].users).toHaveLength(1);
  });

  it('groups members under one emoji and keeps emoji in the order they first appeared', async () => {
    const { asOwner, owner, issueId, commentId } = await setup();
    const asMember = await addProjectMember(asOwner, 'MKT');
    await react(asOwner, commentId, '🎉');
    await react(asMember, commentId, '👍');
    await react(asMember, commentId, '🎉');

    const reactions = await feedReactions(asOwner, issueId, commentId);
    expect(reactions.map((r) => r.emoji)).toEqual(['🎉', '👍']);
    expect(reactions[0].users).toHaveLength(2);
    expect(reactions[0].users[0].id).toBe(owner.userId);
    expect(reactions[1].users).toHaveLength(1);
  });

  it('serves the reactions of a reply and of an entry of a timeline stretch', async () => {
    const { asOwner, issueId, commentId } = await setup();
    const reply = await asOwner
      .issues({ issueId })
      .comments.post({ body: 'answer', replyToId: commentId });
    await react(asOwner, reply.data!.id, '👀');

    expect((await feedReactions(asOwner, issueId, reply.data!.id))[0].emoji).toBe('👀');
    const grouped = await asOwner.issues({ issueId }).feed.grouped.get({ query: {} });
    const groupedReply = grouped
      .data!.groups.flatMap((group) => group.items)
      .find((item) => item.id === reply.data!.id);
    expect(groupedReply!.reactions[0].emoji).toBe('👀');
    const stretch = await asOwner
      .issues({ issueId })
      .timeline.items.get({ query: { from: '2000-01-01T00:00:00.000Z' } });
    expect(stretch.data!.find((item) => item.id === reply.data!.id)!.reactions[0].emoji).toBe('👀');
  });

  it('keeps the reactions on a comment that is edited', async () => {
    const { asOwner, commentId } = await setup();
    await react(asOwner, commentId, '👍');

    const edited = await asOwner.comments({ commentId }).patch({ body: 'changed' });
    expect(edited.data!.reactions.map((r) => r.emoji)).toEqual(['👍']);
  });

  it('removes only the caller’s reaction', async () => {
    const { asOwner, issueId, commentId } = await setup();
    const asMember = await addProjectMember(asOwner, 'MKT');
    await react(asOwner, commentId, '👍');
    await react(asMember, commentId, '👍');

    expect((await unreact(asMember, commentId, '👍')).status).toBe(204);
    const reactions = await feedReactions(asOwner, issueId, commentId);
    expect(reactions).toHaveLength(1);
    expect(reactions[0].users).toHaveLength(1);

    expect((await unreact(asOwner, commentId, '👍')).status).toBe(204);
    expect(await feedReactions(asOwner, issueId, commentId)).toEqual([]);
  });

  it('answers 204 when removing a reaction that is not there', async () => {
    const { asOwner, commentId } = await setup();
    expect((await unreact(asOwner, commentId, '👍')).status).toBe(204);
  });

  it('accepts a flag, a keycap, a skin tone and a joined sequence as one emoji', async () => {
    const { asOwner, commentId } = await setup();
    for (const emoji of ['🇺🇦', '1️⃣', '👍🏽', '👨‍👩‍👧‍👦', '❤️']) {
      expect((await react(asOwner, commentId, emoji)).status).toBe(201);
      expect((await unreact(asOwner, commentId, emoji)).status).toBe(204);
    }
  });

  it('rejects text, two emoji, an empty and an over-long value', async () => {
    const { asOwner, commentId } = await setup();
    for (const emoji of ['ok', '👍👍', '👍 ', '', '<b>', '👍'.repeat(40)]) {
      expect((await react(asOwner, commentId, emoji)).status).toBe(400);
    }
  });

  it('takes the maximum number of different emoji and refuses one more', async () => {
    const { asOwner, commentId } = await setup();
    const emojis = Array.from({ length: MAX_COMMENT_EMOJI + 1 }, (_, i) =>
      String.fromCodePoint(0x1f600 + i),
    );
    for (const emoji of emojis.slice(0, MAX_COMMENT_EMOJI)) {
      expect((await react(asOwner, commentId, emoji)).status).toBe(201);
    }

    expect((await react(asOwner, commentId, emojis[MAX_COMMENT_EMOJI])).status).toBe(409);
    const asMember = await addProjectMember(asOwner, 'MKT');
    expect((await react(asMember, commentId, emojis[0])).status).toBe(201);
  });

  it('removes the reactions with the comment', async () => {
    const { asOwner, issueId, commentId } = await setup();
    await react(asOwner, commentId, '👍');

    expect((await asOwner.comments({ commentId }).delete()).status).toBe(204);
    expect((await react(asOwner, commentId, '👍')).status).toBe(404);
    const res = await asOwner.issues({ issueId }).feed.get({ query: { filter: 'comments' } });
    expect(res.data!.items).toEqual([]);
  });

  it('returns 404 for a missing comment and for a change-log entry', async () => {
    const { asOwner, issueId } = await setup();
    const res = await asOwner.issues({ issueId }).feed.get({ query: { filter: 'history' } });
    const entryId = res.data!.items[0].id;

    expect((await react(asOwner, 999999, '👍')).status).toBe(404);
    expect((await react(asOwner, entryId, '👍')).status).toBe(404);
    expect((await unreact(asOwner, entryId, '👍')).status).toBe(404);
  });

  it('lets a member react to another member’s comment', async () => {
    const { asOwner, commentId } = await setup();
    const asMember = await addProjectMember(asOwner, 'MKT');
    expect((await react(asMember, commentId, '✅')).status).toBe(201);
  });

  it('denies a non-member and a member who may only read', async () => {
    const { asOwner, issueId, commentId } = await setup();
    await react(asOwner, commentId, '👍');
    const outsider = authedApi((await signUpTestUser()).cookie);
    const reader = await createRole(asOwner, 'MKT', {
      name: 'Reader',
      permissions: { work_items: { read: true } },
    });
    const asReader = await addProjectMember(asOwner, 'MKT', reader.data!.id);

    expect((await react(outsider, commentId, '👍')).status).toBe(403);
    expect((await unreact(outsider, commentId, '👍')).status).toBe(403);
    expect((await react(asReader, commentId, '👍')).status).toBe(403);
    expect((await unreact(asReader, commentId, '👍')).status).toBe(403);
    expect(await feedReactions(asReader, issueId, commentId)).toHaveLength(1);
  });

  it('moves the revision of the issue when a reaction is added and when it is removed', async () => {
    const { asOwner, issueId, commentId } = await setup();
    const scope = `issue:${issueId}`;
    const rev = async () =>
      (await asOwner.sync.rev.get({ query: { scopes: scope } })).data!.revs[scope];
    const before = await rev();

    await react(asOwner, commentId, '👍');
    const added = await rev();
    expect(added).not.toBe(before);
    await unreact(asOwner, commentId, '👍');
    expect(await rev()).not.toBe(added);
  });

  it('leaves the reactions out of a public share of the issue', async () => {
    const { asOwner, issueId, commentId } = await setup();
    await react(asOwner, commentId, '👍');
    const token = (await asOwner.issues({ issueId }).share.post({ extended: true })).data!.token;

    const shared = await api.share.issue({ token }).get();
    const comment = shared.data.feed.find((item: { id: number }) => item.id === commentId);
    expect(comment.body).toBe('note');
    expect(comment.reactions).toEqual([]);
  });

  it('refuses a reaction in an archived project', async () => {
    const { asOwner, commentId } = await setup();
    const project = (await asOwner.projects.get()).data!.find((p) => p.key === 'MKT')!;
    const archived = await asOwner
      .teams({ teamId: project.teamId })
      .projects({ projectId: project.id })
      .archive.post();
    expect(archived.status).toBe(200);

    expect((await react(asOwner, commentId, '👍')).status).toBe(403);
  });

  it('adds and removes a reaction through the MCP tools', async () => {
    const { asOwner, owner, issueId, commentId } = await setup();
    const { key } = await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } });

    const added = await mcpRpc(key, 'tools/call', {
      name: 'add_comment_reaction',
      arguments: { commentId, emoji: '✅' },
    });
    expect(JSON.stringify(added)).toContain('"ok":true');
    expect((await feedReactions(asOwner, issueId, commentId)).map((r) => r.emoji)).toEqual(['✅']);

    const removed = await mcpRpc(key, 'tools/call', {
      name: 'remove_comment_reaction',
      arguments: { commentId, emoji: '✅' },
    });
    expect(JSON.stringify(removed)).toContain('"ok":true');
    expect(await feedReactions(asOwner, issueId, commentId)).toEqual([]);
  });

  describe('notification', () => {
    // The 'reacted' items of a member's inbox, newest first.
    async function reactedInbox(client: Api) {
      const res = await client.notifications.get({ query: { types: 'reacted' } });
      return res.data!.items;
    }

    it('tells the author who reacted, with which emoji, on which comment', async () => {
      const { asOwner, issueId, commentId } = await setup();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const reply = (
        await asMember.issues({ issueId }).comments.post({ body: 'mine', replyToId: commentId })
      ).data!;

      await react(asMember, commentId, '🎉');

      const inbox = await reactedInbox(asOwner);
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toMatchObject({
        type: 'reacted',
        reactionEmoji: '🎉',
        actorUserId: reply.actorUserId,
        actorName: reply.actorName,
        issueId,
        issueCommentId: commentId,
        readAt: null,
      });
      expect(await reactedInbox(asMember)).toEqual([]);
    });

    it('tells nobody about a reaction to their own comment', async () => {
      const { asOwner, commentId } = await setup();
      await react(asOwner, commentId, '👍');
      expect(await reactedInbox(asOwner)).toEqual([]);
    });

    it('tells once per member and comment, with the first emoji', async () => {
      const { asOwner, issueId, commentId } = await setup();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const asOther = await addProjectMember(asOwner, 'MKT');
      const second = (await asOwner.issues({ issueId }).comments.post({ body: 'more' })).data!;

      await react(asMember, commentId, '👍');
      await react(asMember, commentId, '🎉');
      await unreact(asMember, commentId, '👍');
      await react(asMember, commentId, '👍');
      expect((await reactedInbox(asOwner)).map((item) => item.reactionEmoji)).toEqual(['👍']);

      await react(asOther, commentId, '👍');
      await react(asMember, second.id, '🚀');
      expect(
        (await reactedInbox(asOwner)).map((item) => [item.issueCommentId, item.reactionEmoji]),
      ).toEqual([
        [second.id, '🚀'],
        [commentId, '👍'],
        [commentId, '👍'],
      ]);
    });

    it('skips an author whose role may no longer read work items', async () => {
      const { asOwner, issueId } = await setup();
      const blind = await createRole(asOwner, 'MKT', { name: 'Blind', permissions: {} });
      const asMember = await addProjectMember(asOwner, 'MKT');
      const comment = (await asMember.issues({ issueId }).comments.post({ body: 'hi' })).data!;
      const changed = await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId: comment.actorUserId! })
        .patch({ role: 'member', roleId: blind.data!.id });
      expect(changed.status).toBe(204);

      await react(asOwner, comment.id, '👍');

      expect(await reactedInbox(asMember)).toEqual([]);
    });

    it('skips an author who is no longer a member of the project', async () => {
      const { asOwner, issueId } = await setup();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const comment = (await asMember.issues({ issueId }).comments.post({ body: 'bye' })).data!;
      const removed = await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId: comment.actorUserId! })
        .delete();
      expect(removed.status).toBe(204);

      await react(asOwner, comment.id, '👍');

      // No route shows the inbox rows of a member who left.
      expect(await db.select().from(notification).where(eq(notification.type, 'reacted'))).toEqual(
        [],
      );
    });

    it('queues the email only for an author who turned the event on', async () => {
      const { asOwner, issueId, commentId } = await setup();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const project = (await asOwner.projects.get()).data!.find((p) => p.key === 'MKT')!;
      await asOwner.teams({ teamId: project.teamId })['notification-settings'].put({
        smtp: {
          enabled: true,
          host: 'smtp.example.com',
          port: 587,
          encryption: 'none',
          username: 'mailer@example.com',
          password: 'secret',
          timeout: null,
        },
      });
      const others = { assigned: true, mentioned: true, commented: true, state_changed: true };
      const prefs = asOwner.projects({ projectKey: 'MKT' })['notification-preferences'];
      expect(
        (await prefs.put({ emailEvents: others, telegramEvents: others })).data!.emailEvents,
      ).toEqual({ ...others, reacted: false });

      await react(asMember, commentId, '👍');
      // No route reads the outbox, and its rows are what the worker sends.
      expect(await db.select().from(notificationDelivery)).toEqual([]);

      await prefs.put({ emailEvents: { ...others, reacted: true }, telegramEvents: others });
      const second = (await asOwner.issues({ issueId }).comments.post({ body: 'more' })).data!;
      await react(asMember, second.id, '🚀');
      const queued = await db.select().from(notificationDelivery);
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({ channel: 'email' });
      expect(queued[0].payload.subject).toContain('reacted to your comment');
      expect(queued[0].payload.text).toContain('with 🚀');
      expect(queued[0].payload.url).toEndWith(`/issue/MKT-1#comment-${second.id}`);
    });
  });
});
