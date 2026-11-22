import { beforeEach, describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { encryptSecret } from '@repo/crypto';
import {
  INSTANCE_EMAIL_SECRET_KEY,
  appSecret,
  db,
  defaultInstanceEmailConfig,
  SLACK_APP_SECRET_KEY,
  project,
  team,
  teamInvite,
  workspace,
  workspaceSlackSetting,
  writeSecret,
} from '@repo/db';
import { eq } from 'drizzle-orm';
import { deliverNotification } from '../../notification-send';

// The send reads the credentials itself, so these cover the two decisions it makes
// before a message can leave: a queued invite email whose invite is gone is dropped
// rather than sent, and a team with no provider configured fails permanently instead
// of being retried forever. The rows the api writes in production are inserted
// directly — there is no api to call.

async function makeProject(): Promise<{ teamId: number; projectId: number }> {
  const [ws] = await db
    .insert(workspace)
    .values({ name: 'Senders' })
    .returning({ id: workspace.id });
  const [row] = await db
    .insert(team)
    .values({ workspaceId: ws!.id, name: 'Senders' })
    .returning({ id: team.id });
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

  it('sends an email the api composed as it is', async () => {
    const { projectId } = await makeProject();
    await writeSecret(
      INSTANCE_EMAIL_SECRET_KEY,
      {
        ...defaultInstanceEmailConfig(),
        resend: { enabled: true, apiKey: 're_test' },
        from: 'noreply@example.test',
      },
      {},
    );
    const realFetch = globalThis.fetch;
    let sent: { text: string; html: string } | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).startsWith('https://api.resend.com/')) return realFetch(input, init);
      sent = JSON.parse(String(init?.body));
      return Response.json({ id: 'sent' });
    }) as typeof fetch;

    const result = await deliverNotification({
      projectId,
      channel: 'email',
      recipient: 'member@example.com',
      payload: {
        subject: 'Hello',
        text: 'Plain\n\nhttps://plan.test/a',
        html: '<table>Composed</table>',
        url: 'https://plan.test/a',
        emailSource: 'instance',
      },
    }).finally(() => {
      globalThis.fetch = realFetch;
    });

    expect(result).toEqual({ ok: true });
    expect(sent).toMatchObject({
      text: 'Plain\n\nhttps://plan.test/a',
      html: '<table>Composed</table>',
    });
  });

  describe('slack', () => {
    const app = {
      botToken: 'xoxb-instance',
      clientId: '1.2',
      clientSecret: 'secret',
      slackTeamId: 'T1',
      slackTeamName: 'Acme',
    };

    async function workspaceOf(teamId: number): Promise<number> {
      const [row] = await db
        .select({ workspaceId: team.workspaceId })
        .from(team)
        .where(eq(team.id, teamId));
      return row!.workspaceId;
    }

    async function setWorkspaceSlack(teamId: number, config: Record<string, unknown>) {
      await db.insert(workspaceSlackSetting).values({
        workspaceId: await workspaceOf(teamId),
        ...encryptSecret(JSON.stringify(config)),
      });
    }

    // Answers chat.postMessage and records what was asked.
    async function send(
      projectId: number,
      answer: () => Response = () => Response.json({ ok: true }),
    ) {
      const realFetch = globalThis.fetch;
      const calls: { url: string; init?: RequestInit }[] = [];
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (!url.startsWith('https://slack.com/api/')) return realFetch(input, init);
        calls.push({ url, init });
        return answer();
      }) as typeof fetch;
      const result = await deliverNotification({
        projectId,
        channel: 'slack',
        recipient: 'U1',
        payload: {
          text: 'plain',
          mrkdwn: '<https://plan.test/a|*MKT-1*> Title',
          url: 'https://plan.test/a',
        },
      }).finally(() => {
        globalThis.fetch = realFetch;
      });
      return { result, calls };
    }

    it('sends a direct message through the instance app', async () => {
      const { projectId } = await makeProject();
      await writeSecret(SLACK_APP_SECRET_KEY, { enabled: true, ...app }, {});

      const { result, calls } = await send(projectId);

      expect(result).toEqual({ ok: true });
      expect(calls.map((c) => c.url)).toEqual(['https://slack.com/api/chat.postMessage']);
      expect(new Headers(calls[0]!.init?.headers).get('authorization')).toBe(
        'Bearer xoxb-instance',
      );
      expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
        channel: 'U1',
        text: '<https://plan.test/a|*MKT-1*> Title',
        unfurl_links: false,
        unfurl_media: false,
      });
    });

    it('sends through the workspace app in place of the instance one', async () => {
      const { teamId, projectId } = await makeProject();
      await writeSecret(SLACK_APP_SECRET_KEY, { enabled: true, ...app }, {});
      await setWorkspaceSlack(teamId, { enabled: true, own: true, ...app, botToken: 'xoxb-own' });

      const { calls } = await send(projectId);

      expect(new Headers(calls[0]!.init?.headers).get('authorization')).toBe('Bearer xoxb-own');
    });

    it('fails permanently when the workspace turned Slack off', async () => {
      const { teamId, projectId } = await makeProject();
      await writeSecret(SLACK_APP_SECRET_KEY, { enabled: true, ...app }, {});
      await setWorkspaceSlack(teamId, { enabled: false, own: false });

      const { result, calls } = await send(projectId);

      expect(result).toEqual({ ok: false, retryable: false, error: 'slack not configured' });
      expect(calls).toHaveLength(0);
    });

    it('tries again when Slack is rate limiting, and not for a refusal', async () => {
      const { projectId } = await makeProject();
      await writeSecret(SLACK_APP_SECRET_KEY, { enabled: true, ...app }, {});

      const limited = await send(
        projectId,
        () => new Response('', { status: 429, headers: { 'retry-after': '1' } }),
      );
      const refused = await send(projectId, () =>
        Response.json({ ok: false, error: 'channel_not_found' }),
      );

      expect(limited.result).toMatchObject({ ok: false, retryable: true });
      expect(refused.result).toEqual({
        ok: false,
        retryable: false,
        error: 'Slack chat.postMessage: channel_not_found',
      });
    });
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
