import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { db, notificationDelivery } from '@repo/db';
import { app, authedApi, internalApi, internalApp } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The split between the public app and the internal instance: /internal/* is not
// served by the public listener at all, the internal one accepts the worker token
// alone, and a notification send names an outbox row rather than carrying the
// message, so the route cannot deliver mail of the caller's choosing.

const WORKER_TOKEN = 'internal-listener-test-worker-token';

const INTERNAL_ROUTES: Array<{ method: 'GET' | 'POST'; path: string }> = [
  { method: 'POST', path: '/internal/agent-runs/execute' },
  { method: 'POST', path: '/internal/agent-threads/delete-for-issues' },
  { method: 'POST', path: '/internal/notification-deliveries/send' },
  { method: 'GET', path: '/internal/telegram/config' },
  { method: 'POST', path: '/internal/telegram/link' },
];

function request(method: string, path: string, body?: unknown, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token == null ? {} : { 'x-worker-token': token }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// An owner whose instance can send mail, with one invite email waiting in the outbox.
async function queueInviteEmail(): Promise<{
  deliveryId: number;
  owner: ReturnType<typeof authedApi>;
}> {
  const user = await signUpTestUser();
  const owner = authedApi(user.cookie);
  await owner.projects.post({ key: 'MKT', name: 'Marketing' });
  const settings = await owner.god['email-settings'].put({
    from: "It's a Plan <noreply@example.com>",
    resend: { enabled: true, apiKey: 're_test_key' },
    allowProjects: false,
  });
  expect(settings.status).toBe(200);
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: 'invitee@example.com', role: 'member' });
  expect(invite.data?.emailQueued).toBe(true);
  // No route lists the outbox; the id is read from the table the worker claims from.
  const [row] = await db.select({ id: notificationDelivery.id }).from(notificationDelivery);
  return { deliveryId: row!.id, owner };
}

describe('internal listener', () => {
  let previousToken: string | undefined;

  beforeEach(async () => {
    previousToken = process.env.WORKER_INTERNAL_TOKEN;
    process.env.WORKER_INTERNAL_TOKEN = WORKER_TOKEN;
    await resetDb();
  });

  afterEach(() => {
    if (previousToken == null) delete process.env.WORKER_INTERNAL_TOKEN;
    else process.env.WORKER_INTERNAL_TOKEN = previousToken;
  });

  describe('public app', () => {
    it('does not serve /internal/* even with the worker token', async () => {
      for (const { method, path } of INTERNAL_ROUTES) {
        const res = await app.handle(request(method, path, {}, WORKER_TOKEN));
        expect(res.status).toBe(404);
      }
    });

    it('leaves the internal routes out of the OpenAPI document', async () => {
      const doc = (await (await app.handle(new Request('http://localhost/docs/json'))).json()) as {
        paths: Record<string, unknown>;
      };
      expect(Object.keys(doc.paths).filter((path) => path.startsWith('/internal/'))).toEqual([]);
    });
  });

  describe('token check', () => {
    it('answers 401 without a token', async () => {
      const res = await internalApp.handle(request('GET', '/internal/telegram/config'));
      expect(res.status).toBe(401);
    });

    it('answers 401 for a wrong token, including one of the right length', async () => {
      const wrongLength = await internalApi('nope').internal.telegram.config.get();
      expect(wrongLength.status).toBe(401);
      const sameLength = await internalApi(
        WORKER_TOKEN.replace(/.$/, 'X'),
      ).internal.telegram.config.get();
      expect(sameLength.status).toBe(401);
    });

    it('answers 401 for every route when the instance has no token configured', async () => {
      delete process.env.WORKER_INTERNAL_TOKEN;
      const res = await internalApi(WORKER_TOKEN).internal.telegram.config.get();
      expect(res.status).toBe(401);
    });

    it('accepts the configured token', async () => {
      const res = await internalApi(WORKER_TOKEN).internal.telegram.config.get();
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ enabled: false, botToken: '', botUsername: '' });
    });
  });

  describe('POST /internal/notification-deliveries/send', () => {
    it('rejects a request that carries a recipient and a message instead of a row id', async () => {
      const res = await internalApp.handle(
        request(
          'POST',
          '/internal/notification-deliveries/send',
          {
            projectId: 1,
            channel: 'email',
            recipient: 'anyone@example.com',
            payload: { subject: 'Hello', text: 'Sent through the api' },
          },
          WORKER_TOKEN,
        ),
      );
      expect(res.status).toBe(400);
    });

    it('rejects an id no pending row has', async () => {
      const res = await internalApi(WORKER_TOKEN).internal['notification-deliveries'].send.post({
        id: 424242,
      });
      expect(res.status).toBe(400);
      expect(res.error?.value as unknown).toEqual({ error: 'Unknown delivery' });
    });

    it('sends the row the id names, with the message stored on it', async () => {
      const { deliveryId, owner } = await queueInviteEmail();
      // With the provider withdrawn, the transport answers instead of Resend, which
      // shows the row was read and handed to the sender.
      const withdrawn = await owner.god['email-settings'].put({
        resend: { enabled: false, apiKey: 're_test_key' },
      });
      expect(withdrawn.status).toBe(200);

      const res = await internalApi(WORKER_TOKEN).internal['notification-deliveries'].send.post({
        id: deliveryId,
      });

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ ok: false, retryable: false, error: 'no email provider enabled' });
    });
  });
});
