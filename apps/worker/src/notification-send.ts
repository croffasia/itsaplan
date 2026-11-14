import {
  db,
  project,
  pushSubscription,
  teamInvite,
  emailSource,
  getDeliveryConfig,
  getInstanceBotConfig,
  getInstanceEmailConfig,
  getProjectEmailConfig,
  getWebPushConfig,
  isInstanceBotUsable,
  type DeliveryPayload,
  type NotificationConfig,
} from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { sendEmail, emailBody, type EmailConfig, type SendResult } from '@repo/mailer';
import { pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { encryptPushPayload, vapidAuthorization } from './web-push';

// Sends one claimed notification_delivery row over its channel. Email transport lives
// in @repo/mailer (shared with the authentication mail sent from @repo/auth); Telegram
// and Web Push are only used here, so they stay in this file, with the push encryption
// in web-push.ts. A team that set no bot token of its own sends through the instance
// bot, the same one members link their Telegram accounts through. Each channel is a
// branch here and a compose function in the api's outbound.ts. The result tells the
// caller whether a failure is worth retrying (transient: network error, timeout, rate
// limit, server error) or permanent (bad credentials, rejected recipient,
// misconfiguration).

export type { SendResult };

export interface SendInput {
  channel: string;
  recipient: string | null;
  payload: DeliveryPayload;
  config: NotificationConfig;
}

async function sendNotificationEmail(input: SendInput): Promise<SendResult> {
  if (!input.recipient) return { ok: false, retryable: false, error: 'no recipient' };
  // The team's own provider when it configured one, otherwise the instance
  // provider (which carries its own From address). A team set to the instance
  // provider stops sending when the administrator withdraws it.
  const source = emailSource(input.config);
  const config: EmailConfig | null =
    input.payload.emailSource === 'instance'
      ? await getInstanceEmailConfig()
      : source === 'system'
        ? await getProjectEmailConfig()
        : source === 'none'
          ? null
          : { smtp: input.config.smtp, resend: input.config.resend, from: input.config.from };
  if (!config) return { ok: false, retryable: false, error: 'email not configured' };
  const { text, html } = input.payload.html
    ? { text: input.payload.text, html: input.payload.html }
    : emailBody(input.payload.text, input.payload.url);
  return sendEmail(config, {
    to: input.recipient,
    subject: input.payload.subject ?? '',
    text,
    html,
    idempotencyKey: input.payload.idempotencyKey,
  });
}

async function sendTelegram(input: SendInput): Promise<SendResult> {
  const { telegram } = input.config;
  if (!telegram.enabled) {
    return { ok: false, retryable: false, error: 'telegram not configured' };
  }
  // The team's own bot when it set one, otherwise the instance bot the members
  // linked their accounts through.
  const instance = telegram.botToken ? null : await getInstanceBotConfig();
  const botToken =
    telegram.botToken || (instance && isInstanceBotUsable(instance) ? instance.botToken : '');
  if (!botToken) return { ok: false, retryable: false, error: 'telegram not configured' };
  if (!input.recipient) return { ok: false, retryable: false, error: 'no chat id' };
  const chatId = input.recipient;
  // Prefer the HTML body (clickable issue link, formatting); fall back to plain text
  // with the link appended on its own blank line when a row carries no HTML. The
  // payload text never contains the URL itself, so it is added exactly once here.
  const useHtml = Boolean(input.payload.html);
  const text = useHtml
    ? input.payload.html!
    : input.payload.url
      ? `${input.payload.text}\n\n${input.payload.url}`
      : input.payload.text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(useHtml ? { parse_mode: 'HTML' } : {}),
        link_preview_options: { is_disabled: true },
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    // A 429 or 5xx is transient; other 4xx (bad token, chat not found) is permanent.
    return {
      ok: false,
      retryable: res.status === 429 || res.status >= 500,
      error: `Telegram HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'telegram request failed',
    };
  }
}

export type PushFetch = typeof pinnedFetch;

// How long the push service keeps a message for a browser that is offline.
const PUSH_TTL_SECONDS = 24 * 60 * 60;

// The whole request, from the connection to the last byte of the answer. The idle
// timeout of pinnedFetch alone would let an endpoint that answers a byte at a time hold
// the batch, and every team's notifications queued behind it, for hours.
const PUSH_DEADLINE_MS = 10_000;

// Sends one push message to the browser of a push_subscription row, named by its id.
// The endpoint is the browser's choice, so it goes through the SSRF guard under the
// public-only policy the api stored it with. A 404 or 410 means the push service dropped
// the subscription, so its row goes. A row made with other VAPID keys gets nothing but
// stays: during a deploy the worker can still hold the old keys while the api stores rows
// made with the new ones.
export async function sendPush(
  recipient: string | null,
  payload: DeliveryPayload,
  fetch: PushFetch = pinnedFetch,
): Promise<SendResult> {
  const vapid = getWebPushConfig();
  if (!vapid) return { ok: false, retryable: false, error: 'push not configured' };
  const id = Number(recipient);
  if (!recipient || !Number.isInteger(id)) {
    return { ok: false, retryable: false, error: 'no subscription id' };
  }
  const [subscription] = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.id, id));
  // The member turned push off on that browser, or its push service dropped it, after
  // this was queued: there is nobody left to send to.
  if (!subscription) return { ok: true };
  if (subscription.vapidPublicKey !== vapid.publicKey) {
    return { ok: false, retryable: false, error: 'push subscription made with other VAPID keys' };
  }

  let body: Uint8Array;
  let authorization: string;
  try {
    const message = {
      title: payload.title,
      body: payload.text,
      url: payload.url,
      tag: payload.tag,
    };
    body = await encryptPushPayload(Buffer.from(JSON.stringify(message)), {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    });
    authorization = await vapidAuthorization(subscription.endpoint, vapid);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'could not encrypt the message';
    return { ok: false, retryable: false, error: `push: ${reason}` };
  }

  let res: Response;
  try {
    res = await fetch(subscription.endpoint, {
      method: 'POST',
      publicOnly: true,
      signal: AbortSignal.timeout(PUSH_DEADLINE_MS),
      headers: {
        authorization,
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        'content-length': String(body.length),
        ttl: String(PUSH_TTL_SECONDS),
        urgency: 'normal',
      },
      body: Buffer.from(body),
      maxBytes: 1024,
      truncateBody: true,
    });
  } catch (err) {
    return {
      ok: false,
      retryable: !(err instanceof UrlNotAllowedError),
      error: err instanceof Error ? err.message : 'push request failed',
    };
  }

  if (res.status >= 200 && res.status < 300) return { ok: true };
  const error = `push HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`;
  if (res.status === 404 || res.status === 410) {
    await db.delete(pushSubscription).where(eq(pushSubscription.id, subscription.id));
    return { ok: false, retryable: false, error };
  }
  // A 429 or 5xx is transient; any other answer (a refused token, a payload too large)
  // is permanent.
  return { ok: false, retryable: res.status === 429 || res.status >= 500, error };
}

async function sendDelivery(input: SendInput): Promise<SendResult> {
  if (input.channel === 'email') return sendNotificationEmail(input);
  if (input.channel === 'telegram') return sendTelegram(input);
  if (input.channel === 'push') return sendPush(input.recipient, input.payload);
  return { ok: false, retryable: false, error: `unknown channel: ${input.channel}` };
}

// Whether a queued invite email still has a live invite behind it.
async function isInvitePending(projectId: number, inviteId: number): Promise<boolean> {
  const rows = await db
    .select({ id: teamInvite.id })
    .from(teamInvite)
    .where(
      and(
        eq(teamInvite.projectId, projectId),
        eq(teamInvite.id, inviteId),
        eq(teamInvite.status, 'pending'),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// The credentials belong to the team that owns the project the row came from.
async function teamOf(projectId: number): Promise<number | null> {
  const rows = await db
    .select({ teamId: project.teamId })
    .from(project)
    .where(eq(project.id, projectId));
  return rows[0]?.teamId ?? null;
}

export interface DeliveryRow {
  projectId: number;
  channel: string;
  recipient: string | null;
  payload: DeliveryPayload;
}

export async function deliverNotification(row: DeliveryRow): Promise<SendResult> {
  if (
    row.payload.projectInviteId != null &&
    !(await isInvitePending(row.projectId, row.payload.projectInviteId))
  ) {
    // The invite was accepted, rejected, or revoked while its email waited in the
    // outbox. Treat it as delivered so the row is removed.
    return { ok: true };
  }
  const teamId = await teamOf(row.projectId);
  if (teamId == null) return { ok: false, retryable: false, error: 'Project not found' };
  return sendDelivery({
    channel: row.channel,
    recipient: row.recipient,
    payload: row.payload,
    config: await getDeliveryConfig(teamId),
  });
}
