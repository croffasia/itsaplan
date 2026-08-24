import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { addProjectMember } from '#tests/helpers/members';
import { resetDb } from '#tests/helpers/db';

// The time logged on an issue: one entry per stretch of work, each belonging to the
// member who logged it. The entries are read on their own
// (GET /issues/:issueId/worklogs); the issue payload carries their sum as
// `loggedMinutes`. A member owns their entries — changing or deleting someone
// else's is a project owner's call, no matter what the role matrix grants.

interface Setup {
  asOwner: Api;
  columnId: number;
}

async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  return { asOwner, columnId: view.data!.columns[0].id };
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

const today = () => new Date().toISOString().slice(0, 10);

function dayFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function log(
  client: Api,
  issueId: number,
  body: { minutes: number; spentOn?: string; note?: string | null },
) {
  return client.issues({ issueId }).worklogs.post({ spentOn: today(), ...body });
}

async function entriesOf(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).worklogs.get();
  return res.data!;
}

async function read(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!;
}

// spentOn is a date column, which the Treaty client revives into a Date; the day it
// names is what the tests assert.
function day(value: unknown): string {
  return new Date(value as string).toISOString().slice(0, 10);
}

async function feedActions(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).feed.get({ query: {} });
  return res.data!.items.map((item) => item.action);
}

describe('worklogs', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('logging time', () => {
    it('stores the minutes, the day and the note, and sums them on the issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await log(asOwner, issue.id, { minutes: 90, note: 'Pairing on the parser' });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        issueId: issue.id,
        minutes: 90,
        note: 'Pairing on the parser',
      });
      expect(day(res.data!.spentOn)).toBe(today());
      expect(await read(asOwner, issue.id)).toMatchObject({ loggedMinutes: 90 });
    });

    it('logs on an earlier day and leaves the note unset', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await log(asOwner, issue.id, { minutes: 30, spentOn: dayFromToday(-3) });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ minutes: 30, note: null });
      expect(day(res.data!.spentOn)).toBe(dayFromToday(-3));
    });

    it('rejects a day in the future with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await log(asOwner, issue.id, { minutes: 60, spentOn: dayFromToday(1) });
      expect(res.status).toBe(400);
      expect(await entriesOf(asOwner, issue.id)).toEqual([]);
    });

    it('rejects a day that is not a date with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      expect((await log(asOwner, issue.id, { minutes: 60, spentOn: 'yesterday' })).status).toBe(
        400,
      );
    });

    it('rejects no time and a time of zero with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      expect(
        (
          await asOwner
            .issues({ issueId: issue.id })
            .worklogs.post({ spentOn: today() } as unknown as { minutes: number; spentOn: string })
        ).status,
      ).toBe(400);
      expect((await log(asOwner, issue.id, { minutes: 0 })).status).toBe(400);
    });

    it('rejects a note over 500 characters with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      expect((await log(asOwner, issue.id, { minutes: 15, note: 'x'.repeat(501) })).status).toBe(
        400,
      );
      expect((await log(asOwner, issue.id, { minutes: 15, note: 'x'.repeat(500) })).status).toBe(
        201,
      );
    });

    it('keeps each member on their own entry and sums both onto the issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const issue = (await createIssue(asOwner, columnId)).data!;

      await log(asOwner, issue.id, { minutes: 120 });
      await log(asMember, issue.id, { minutes: 45 });

      const entries = await entriesOf(asOwner, issue.id);
      expect(entries).toHaveLength(2);
      expect(new Set(entries.map((entry) => entry.userId)).size).toBe(2);
      expect(await read(asOwner, issue.id)).toMatchObject({ loggedMinutes: 165 });
    });

    it('lists the entries newest day first', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      await log(asOwner, issue.id, { minutes: 60, spentOn: dayFromToday(-2) });
      await log(asOwner, issue.id, { minutes: 30, spentOn: today() });

      expect((await entriesOf(asOwner, issue.id)).map((entry) => entry.minutes)).toEqual([30, 60]);
    });

    it('denies a non-member with 403', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outsider = await signUpTestUser();

      expect((await log(authedApi(outsider.cookie), issue.id, { minutes: 60 })).status).toBe(403);
    });
  });

  describe('changing and deleting an entry', () => {
    it('changes the time, the day and the note of an own entry', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 60 })).data!;

      const res = await asOwner
        .worklogs({ worklogId: entry.id })
        .patch({ minutes: 75, spentOn: dayFromToday(-1), note: 'Review too' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ minutes: 75, note: 'Review too' });
      expect(day(res.data!.spentOn)).toBe(dayFromToday(-1));
      expect(await read(asOwner, issue.id)).toMatchObject({ loggedMinutes: 75 });
    });

    it('rejects moving an entry to a future day with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 60 })).data!;

      const res = await asOwner
        .worklogs({ worklogId: entry.id })
        .patch({ spentOn: dayFromToday(1) });
      expect(res.status).toBe(400);
    });

    it('deletes an own entry and lowers the sum by that entry alone', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const kept = (await log(asOwner, issue.id, { minutes: 60 })).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 30 })).data!;

      expect((await asOwner.worklogs({ worklogId: entry.id }).delete()).status).toBe(204);
      expect(await read(asOwner, issue.id)).toMatchObject({ loggedMinutes: 60 });
      expect((await entriesOf(asOwner, issue.id)).map((e) => e.id)).toEqual([kept.id]);
    });

    // The default member role carries work_items delete, so this member may delete
    // the issue itself and still not touch what someone else logged on it.
    it("answers 403 on another member's entry for a member who is not an owner", async () => {
      const { asOwner, columnId } = await setupProject();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 60 })).data!;

      expect((await asMember.worklogs({ worklogId: entry.id }).patch({ minutes: 5 })).status).toBe(
        403,
      );
      expect((await asMember.worklogs({ worklogId: entry.id }).delete()).status).toBe(403);
      expect(await read(asOwner, issue.id)).toMatchObject({ loggedMinutes: 60 });
    });

    it("lets a project owner change another member's entry", async () => {
      const { asOwner, columnId } = await setupProject();
      const asMember = await addProjectMember(asOwner, 'MKT');
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asMember, issue.id, { minutes: 60 })).data!;

      expect((await asOwner.worklogs({ worklogId: entry.id }).patch({ minutes: 30 })).status).toBe(
        200,
      );
      expect((await asOwner.worklogs({ worklogId: entry.id }).delete()).status).toBe(204);
    });

    it('answers 404 for an entry that does not exist', async () => {
      const { asOwner } = await setupProject();

      expect((await asOwner.worklogs({ worklogId: 999999 }).delete()).status).toBe(404);
      expect((await asOwner.worklogs({ worklogId: 999999 }).patch({ minutes: 5 })).status).toBe(
        404,
      );
    });
  });

  describe('activity', () => {
    it('writes an entry to the feed for logging, changing and deleting', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 60 })).data!;
      await asOwner.worklogs({ worklogId: entry.id }).patch({ minutes: 90 });
      await asOwner.worklogs({ worklogId: entry.id }).delete();

      expect((await feedActions(asOwner, issue.id)).filter((a) => a === 'worklog')).toHaveLength(3);
    });

    it('carries the time and the day, and what a change replaced', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 90, spentOn: dayFromToday(-1) }))
        .data!;
      await asOwner.worklogs({ worklogId: entry.id }).patch({ minutes: 120, spentOn: today() });

      const feed = (await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} })).data!;
      const changed = feed.items.find((item) => item.action === 'worklog')!;
      expect(changed.payload.from).toMatchObject({ value: '1h 30m' });
      expect(day(changed.payload.from!.date)).toBe(dayFromToday(-1));
      expect(changed.payload.to).toMatchObject({ value: '2h' });
      expect(day(changed.payload.to!.date)).toBe(today());
    });

    it('leaves the feed alone when a patch changes neither the time nor the day', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const entry = (await log(asOwner, issue.id, { minutes: 60 })).data!;
      await asOwner.worklogs({ worklogId: entry.id }).patch({ note: 'Typo fixed' });

      expect((await feedActions(asOwner, issue.id)).filter((a) => a === 'worklog')).toHaveLength(1);
    });
  });

  it('deletes the entries with the issue', async () => {
    const { asOwner, columnId } = await setupProject();
    const issue = (await createIssue(asOwner, columnId)).data!;
    const entry = (await log(asOwner, issue.id, { minutes: 60 })).data!;

    await asOwner.issues({ issueId: issue.id }).delete();

    expect((await asOwner.worklogs({ worklogId: entry.id }).delete()).status).toBe(404);
  });
});
