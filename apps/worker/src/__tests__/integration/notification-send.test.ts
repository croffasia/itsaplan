import { beforeEach, describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { appSecret, db, project, team, teamInvite } from '@repo/db';
import { deliverNotification } from '../../notification-send';

// The send reads the credentials itself, so these cover the two decisions it makes
// before a message can leave: a queued invite email whose invite is gone is dropped
// rather than sent, and a team with no provider configured fails permanently instead
// of being retried forever. The rows the api writes in production are inserted
// directly — there is no api to call.

async function makeProject(): Promise<{ teamId: number; projectId: number }> {
  const [row] = await db.insert(team).values({ name: 'Senders' }).returning({ id: team.id });
  const [created] = await db
    .insert(project)
    .values({ teamId: row!.id, key: randomUUID().slice(0, 8), name: 'Marketing' })
    .returning({ id: project.id });
  return { teamId: row!.id, projectId: created!.id };
}

describe('deliverNotification', () => {
  // A team with no provider of its own falls back to the instance one, so the suite
  // that ran before this in the shared test database must not leave one behind.
  beforeEach(async () => {
    await db.delete(appSecret);
  });

  it('drops an invite email whose invite is no longer pending', async () => {
    const { teamId, projectId } = await makeProject();
    const [invite] = await db
      .insert(teamInvite)
      .values({
        teamId,
        projectId,
        email: 'invitee@example.com',
        status: 'accepted',
      })
      .returning({ id: teamInvite.id });

    const result = await deliverNotification({
      projectId,
      channel: 'email',
      recipient: 'invitee@example.com',
      payload: { text: 'Invitation', projectInviteId: invite!.id },
    });

    expect(result).toEqual({ ok: true });
  });

  it('fails permanently when the team has no email provider', async () => {
    const { projectId } = await makeProject();

    const result = await deliverNotification({
      projectId,
      channel: 'email',
      recipient: 'member@example.com',
      payload: { text: 'Assigned to you' },
    });

    expect(result).toEqual({ ok: false, retryable: false, error: 'email not configured' });
  });

  it('fails permanently when the project is gone', async () => {
    const result = await deliverNotification({
      projectId: 0,
      channel: 'email',
      recipient: 'member@example.com',
      payload: { text: 'Assigned to you' },
    });

    expect(result).toEqual({ ok: false, retryable: false, error: 'Project not found' });
  });
});
