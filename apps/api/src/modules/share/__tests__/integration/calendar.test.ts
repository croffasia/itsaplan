import { describe, it, expect, beforeEach } from 'bun:test';
import { app, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The public calendar feed of a shared view. It reuses the view's share token and
// its filters, and turns each dated issue into an all-day event.

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const board = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = board.data!.columns[0].id;
  const issue = await asOwner
    .projects({ projectKey: 'MKT' })
    .issues.post({ columnId, title: 'Shared thing' });
  return { asOwner, columnId, issueId: issue.data!.id, board: board.data! };
}

// The dotted last segment is outside the Eden client's route map, so call the app.
async function getFeed(token: string) {
  const res = await app.handle(new Request(`http://localhost/share/view/${token}/calendar.ics`));
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    body: await res.text(),
  };
}

function shareView(asOwner: ReturnType<typeof authedApi>, viewId: number, extended?: boolean) {
  return extended === undefined
    ? asOwner.views({ viewId }).share.post()
    : asOwner.views({ viewId }).share.post({ extended });
}

describe('shared view calendar feed', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('serves an all-day event for each dated issue', async () => {
    const { asOwner, columnId, issueId } = await setup();
    await asOwner.issues({ issueId }).patch({ dueDate: '2026-11-03' });
    const undated = await asOwner
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId, title: 'No date' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
    const token = (await shareView(asOwner, view.data!.id)).data!.token;

    const feed = await getFeed(token);
    expect(feed.status).toBe(200);
    expect(feed.contentType).toContain('text/calendar');
    expect(feed.body).toContain('BEGIN:VCALENDAR');
    expect(feed.body).toContain('X-WR-CALNAME:Board');
    expect(feed.body).toContain(`UID:issue-${issueId}@itsaplan`);
    expect(feed.body).toContain('DTSTART;VALUE=DATE:20261103');
    expect(feed.body).toContain('DTEND;VALUE=DATE:20261104');
    expect(feed.body).toContain('SUMMARY:MKT-1 Shared thing');
    expect(feed.body).not.toContain(`issue-${undated.data!.id}@itsaplan`);
    expect(feed.body.endsWith('\r\n')).toBe(true);
  });

  it('uses the start date the view places issues by', async () => {
    const { asOwner, issueId } = await setup();
    const patched = await asOwner.issues({ issueId }).patch({ startDate: '2026-12-01' });
    expect(patched.status).toBe(200);
    const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({
      name: 'Calendar',
      display: { calendarDateField: 'startDate' },
    });
    const token = (await shareView(asOwner, view.data!.id)).data!.token;

    const feed = await getFeed(token);
    expect(feed.body).toContain('DTSTART;VALUE=DATE:20261201');
  });

  it('uses a custom date field only when the link exposes it', async () => {
    const { asOwner, issueId } = await setup();
    await asOwner.issues({ issueId }).patch({ dueDate: '2026-11-03' });
    const field = await asOwner
      .projects({ projectKey: 'MKT' })
      ['custom-fields'].post({ name: 'Ship on', fieldType: 'date' });
    await asOwner
      .issues({ issueId })
      .fields({ fieldId: field.data!.id })
      .put({ value: '2026-12-15' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({
      name: 'Calendar',
      display: { calendarDateField: `cf:${field.data!.id}` },
    });
    const viewId = view.data!.id;

    const token = (await shareView(asOwner, viewId, true)).data!.token;
    expect((await getFeed(token)).body).toContain('DTSTART;VALUE=DATE:20261215');

    // The same view without full issue details hides the custom field value, so the
    // feed falls back to the due date.
    await shareView(asOwner, viewId, false);
    expect((await getFeed(token)).body).toContain('DTSTART;VALUE=DATE:20261103');
  });

  it('keeps the view filters', async () => {
    const { asOwner, board, columnId, issueId } = await setup();
    await asOwner.issues({ issueId }).patch({ dueDate: '2026-11-03' });
    const hiddenColumn = board.columns[1].id;
    const hidden = await asOwner
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId: hiddenColumn, title: 'Hidden' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({
      name: 'Filtered',
      filters: { conditions: [{ id: 'c1', field: 'status', op: 'is', values: [columnId] }] },
    });
    const token = (await shareView(asOwner, view.data!.id)).data!.token;

    const feed = await getFeed(token);
    expect(feed.body).toContain(`issue-${issueId}@itsaplan`);
    expect(feed.body).not.toContain(`issue-${hidden.data!.id}@itsaplan`);
  });

  it('escapes the title and folds long lines', async () => {
    const { asOwner, issueId } = await setup();
    const title = `Ship, review; today ${'x'.repeat(90)}`;
    await asOwner.issues({ issueId }).patch({ title, dueDate: '2026-11-03' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
    const token = (await shareView(asOwner, view.data!.id)).data!.token;

    const feed = await getFeed(token);
    const unfolded = feed.body.replace(/\r\n[ ]/g, '');
    expect(unfolded).toContain(`SUMMARY:MKT-1 Ship\\, review\\; today ${'x'.repeat(90)}`);
    for (const line of feed.body.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('revokes the feed when the view link is revoked', async () => {
    const { asOwner, issueId } = await setup();
    await asOwner.issues({ issueId }).patch({ dueDate: '2026-11-03' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
    const token = (await shareView(asOwner, view.data!.id)).data!.token;
    expect((await getFeed(token)).status).toBe(200);

    await asOwner.views({ viewId: view.data!.id }).share.delete();
    expect((await getFeed(token)).status).toBe(404);
  });

  it('rejects a malformed token and 404s an unknown one', async () => {
    expect((await getFeed('not-a-uuid')).status).toBe(400);
    expect((await getFeed('00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});
