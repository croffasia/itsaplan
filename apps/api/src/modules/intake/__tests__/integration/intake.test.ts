import { describe, it, expect, beforeEach } from 'bun:test';
import { db, intakeRequest, webhookDelivery } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

type Client = ReturnType<typeof authedApi>;

async function setupProjectWithIntake(): Promise<{
  api: Client;
  userId: string;
}> {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  const patched = await api
    .projects({ projectKey: 'MKT' })
    .settings.patch({ features: { intake: true } });
  expect(patched.status).toBe(200);
  return { api, userId: owner.userId };
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

describe('intake queue', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('is off by default and rejects intake routes until enabled', async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    await createProject(api, { key: 'MKT', name: 'Marketing' });
    const view = await api.projects({ projectKey: 'MKT' }).get();
    expect(view.data?.project.intakeEnabled).toBe(false);

    const blocked = await api.projects({ projectKey: 'MKT' }).intake.get({ query: {} });
    expect(blocked.status).toBe(403);

    const enabled = await api
      .projects({ projectKey: 'MKT' })
      .settings.patch({ features: { intake: true } });
    expect(enabled.status).toBe(200);
    expect(enabled.data?.features.intake).toBe(true);

    const listed = await api.projects({ projectKey: 'MKT' }).intake.get({ query: {} });
    expect(listed.status).toBe(200);
    expect(listed.data?.items).toEqual([]);
  });

  it('files requests with source and externalId dedup, keeping them off the board', async () => {
    const { api } = await setupProjectWithIntake();

    const filed = await api.projects({ projectKey: 'MKT' }).intake.post({
      title: 'Feedback widget report',
      description: 'Button misaligned on mobile',
      source: 'feedback-widget',
      externalId: 'fb-123',
      priority: 'medium',
    });
    expect(filed.status).toBe(201);
    expect(filed.data).toMatchObject({
      title: 'Feedback widget report',
      status: 'pending',
      source: 'feedback-widget',
      externalId: 'fb-123',
      priority: 'medium',
    });

    // Duplicate (project, source, externalId) is refused with 409.
    const dup = await api.projects({ projectKey: 'MKT' }).intake.post({
      title: 'Feedback widget report again',
      source: 'feedback-widget',
      externalId: 'fb-123',
    });
    expect(dup.status).toBe(409);

    // A service can look up whether it already filed this externalId.
    const lookup = await api.projects({ projectKey: 'MKT' }).intake.get({
      query: { status: 'all', source: 'feedback-widget', externalId: 'fb-123' },
    });
    expect(lookup.status).toBe(200);
    expect(lookup.data?.items).toHaveLength(1);
    expect(lookup.data?.items[0]?.id).toBe(filed.data!.id);

    // Not on the board.
    const board = await api.projects({ projectKey: 'MKT' }).issues.board.get();
    expect(board.status).toBe(200);
    expect(board.data?.issues).toEqual([]);

    // Summary reports waiting count and oldest waiting timestamp/age.
    const summary = await api.projects({ projectKey: 'MKT' }).intake.summary.get();
    expect(summary.status).toBe(200);
    expect(summary.data?.pendingCount).toBe(1);
    expect(summary.data?.oldestPendingAt).not.toBeNull();
    expect(typeof summary.data?.oldestPendingAgeMs).toBe('number');
  });

  it('accepts a request into an issue with comments, assignee, due date, inbox notification, and webhook', async () => {
    const { api: ownerApi } = await setupProjectWithIntake();
    const member = await addMember(ownerApi);

    await ownerApi.projects({ projectKey: 'MKT' }).webhooks.post({
      url: 'https://example.com/hook',
      events: ['intake.created', 'intake.accepted'],
    });

    const filed = await member.api.projects({ projectKey: 'MKT' }).intake.post({
      title: 'Add dark mode toggle',
      description: 'Requested by customer support',
      source: 'support-bot',
    });
    expect(filed.status).toBe(201);
    const requestId = filed.data!.id;

    const comment = await member.api
      .intake({ requestId })
      .comments.post({ body: 'Extra context from ticket #42' });
    expect(comment.status).toBe(201);

    const accepted = await ownerApi.intake({ requestId }).accept.post({
      assigneeUserId: member.userId,
      dueDate: '2027-01-15',
    });
    expect(accepted.status).toBe(200);
    expect(accepted.data?.request).toMatchObject({
      id: requestId,
      status: 'accepted',
      acceptedIssueId: accepted.data!.issue.id,
    });
    expect(accepted.data?.issue).toMatchObject({
      title: 'Add dark mode toggle',
      description: 'Requested by customer support',
      assigneeUserId: member.userId,
    });
    expect(new Date(accepted.data!.issue.dueDate!).toISOString().slice(0, 10)).toBe('2027-01-15');

    // Comments were carried over onto the created issue.
    const feed = await ownerApi
      .issues({ issueId: accepted.data!.issue.id })
      .feed.get({ query: {} });
    expect(feed.status).toBe(200);
    expect(
      feed.data?.items.some(
        (a) => a.kind === 'comment' && a.body === 'Extra context from ticket #42',
      ),
    ).toBe(true);

    // Submitter received an inbox notification.
    const inbox = await member.api.notifications.get({ query: {} });
    expect(inbox.status).toBe(200);
    expect(
      inbox.data?.items.some(
        (n) => n.type === 'intake_accepted' && n.intakeRequestId === requestId,
      ),
    ).toBe(true);

    // Webhook deliveries were queued for intake.created and intake.accepted.
    const deliveries = await db
      .select({ eventType: webhookDelivery.eventType })
      .from(webhookDelivery);
    const types = deliveries.map((d) => d.eventType);
    expect(types).toContain('intake.created');
    expect(types).toContain('intake.accepted');

    // Accepting again is refused with 409.
    const again = await ownerApi.intake({ requestId }).accept.post({});
    expect(again.status).toBe(409);
  });

  it('declines with a reason, snoozes until a future date (resurfacing when due), and marks duplicates', async () => {
    const { api: ownerApi } = await setupProjectWithIntake();
    const member = await addMember(ownerApi);

    // Decline with reason
    const req1 = (
      await member.api.projects({ projectKey: 'MKT' }).intake.post({ title: 'Out of scope' })
    ).data!;
    const declined = await ownerApi
      .intake({ requestId: req1.id })
      .decline.post({ reason: 'Not aligned with Q3 roadmap' });
    expect(declined.status).toBe(200);
    expect(declined.data).toMatchObject({
      status: 'declined',
      declineReason: 'Not aligned with Q3 roadmap',
    });

    // Snooze rejects past dates, accepts future dates, and resurfaces as pending when past.
    const req2 = (
      await member.api.projects({ projectKey: 'MKT' }).intake.post({ title: 'Revisit later' })
    ).data!;
    const badSnooze = await ownerApi
      .intake({ requestId: req2.id })
      .snooze.post({ until: '2020-01-01' });
    expect(badSnooze.status).toBe(400);

    const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const snoozed = await ownerApi
      .intake({ requestId: req2.id })
      .snooze.post({ until: futureDate });
    expect(snoozed.status).toBe(200);
    expect(snoozed.data?.status).toBe('snoozed');

    const snoozedList = await ownerApi
      .projects({ projectKey: 'MKT' })
      .intake.get({ query: { status: 'snoozed' } });
    expect(snoozedList.data?.items.map((i) => i.id)).toContain(req2.id);

    // Move snoozedUntil into the past to verify resurfacing.
    await db
      .update(intakeRequest)
      .set({ snoozedUntil: new Date(Date.now() - 60_000) })
      .where(eq(intakeRequest.id, req2.id));
    const pendingList = await ownerApi
      .projects({ projectKey: 'MKT' })
      .intake.get({ query: { status: 'pending' } });
    expect(pendingList.data?.items.map((i) => i.id)).toContain(req2.id);

    // Mark as duplicate of an existing issue.
    const board = await ownerApi.projects({ projectKey: 'MKT' }).get();
    const colId = board.data!.columns[0]!.id;
    const existingIssue = (
      await ownerApi
        .projects({ projectKey: 'MKT' })
        .issues.post({ title: 'Existing issue', columnId: colId })
    ).data!;

    const req3 = (
      await member.api.projects({ projectKey: 'MKT' }).intake.post({ title: 'Dup request' })
    ).data!;
    const dup = await ownerApi
      .intake({ requestId: req3.id })
      .duplicate.post({ issueId: existingIssue.id });
    expect(dup.status).toBe(200);
    expect(dup.data).toMatchObject({
      status: 'duplicate',
      duplicateOfIssueId: existingIssue.id,
    });

    // Submitter got notifications for decline, snooze, and duplicate.
    const inbox = await member.api.notifications.get({ query: {} });
    const notifTypes = inbox.data!.items.map((n) => n.type);
    expect(notifTypes).toContain('intake_declined');
    expect(notifTypes).toContain('intake_snoozed');
    expect(notifTypes).toContain('intake_duplicate');
  });

  it('denies non-members with 403', async () => {
    await setupProjectWithIntake();
    const outsider = await signUpTestUser();
    const outsiderApi = authedApi(outsider.cookie);

    const res = await outsiderApi.projects({ projectKey: 'MKT' }).intake.get({ query: {} });
    expect(res.status).toBe(403);
  });
});
