import { describe, it, expect, beforeEach } from 'bun:test';
import { db, issue } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { sweepStaleIssues } from '../../auto-archive';

// The sweep the api runs in the background. Inactivity is the whole point of it, and
// no route can move an issue's updated_at into the past, so that one field is set
// directly; everything else goes through the API.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const api = authedApi(owner.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  const columns = (await api.projects({ projectKey: 'MKT' }).get()).data!.columns;
  const done = columns.find((c) => c.stateType === 'completed')!;
  const todo = columns.find((c) => c.stateType === 'unstarted')!;
  await api.projects({ projectKey: 'MKT' }).settings['auto-archive'].patch({
    completedDays: 14,
    canceledDays: null,
  });
  return { api, doneId: done.id, todoId: todo.id };
}

async function addIssue(api: ReturnType<typeof authedApi>, columnId: number, title: string) {
  const created = (await api.projects({ projectKey: 'MKT' }).issues.post({ columnId, title }))
    .data!;
  return created.id;
}

function backdate(issueId: number, days: number) {
  return db
    .update(issue)
    .set({ updatedAt: sql`now() - make_interval(days => ${days})` })
    .where(eq(issue.id, issueId));
}

describe('auto-archive sweep', () => {
  beforeEach(resetDb);

  it('archives an issue idle past the threshold and logs it', async () => {
    const { api, doneId } = await setup();
    const issueId = await addIssue(api, doneId, 'Shipped');
    await backdate(issueId, 20);

    expect(await sweepStaleIssues()).toBe(1);

    expect((await api.issues({ issueId }).get()).data!.archivedAt).not.toBeNull();
    const feed = (await api.issues({ issueId }).feed.get()).data!;
    expect(feed.items.map((entry) => entry.action)).toContain('archived');
  });

  it('leaves an issue that is still active, recently touched, or in a live column', async () => {
    const { api, doneId, todoId } = await setup();
    const recent = await addIssue(api, doneId, 'Just done');
    const open = await addIssue(api, todoId, 'In progress');
    await backdate(open, 20);

    expect(await sweepStaleIssues()).toBe(0);

    expect((await api.issues({ issueId: recent }).get()).data!.archivedAt).toBeNull();
    expect((await api.issues({ issueId: open }).get()).data!.archivedAt).toBeNull();
  });

  it('does nothing on a second pass over the issues it already archived', async () => {
    const { api, doneId } = await setup();
    const issueId = await addIssue(api, doneId, 'Shipped');
    await backdate(issueId, 20);
    await sweepStaleIssues();

    expect(await sweepStaleIssues()).toBe(0);
  });
});
