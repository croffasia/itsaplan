import { db, notificationDelivery, issue, project, user } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { getProjectEmailConfig } from '@repo/auth';
import { emailSource, readRedactedSettings } from '../notification-settings/store';
import { getPreferencesForUsers } from '../notification-preferences/store';
import { getTelegramChatIds, hasUsableInstanceBot } from '../telegram/store';
import { escapeHtml } from '../shared/lib';
import type { NotificationType, NewNotificationRow } from './store';

// Outbound notification delivery: turns the inbox notification rows produced by an
// issue event into notification_delivery outbox rows. Delivery is per member and per
// their own preferences: for each inbox row (already one per recipient), the member's
// notification-preferences decide whether it goes by email (to their account address)
// and/or Telegram (to the chat of the Telegram account they linked). The project
// supplies the provider credentials (SMTP/Resend, and optionally its own bot token —
// Telegram otherwise goes through the instance bot). The message text is composed
// here at enqueue time and stored on the row; the worker drains the outbox and the
// sender reads the credentials at send time.
//
// This is best-effort: enqueue never throws into the caller (a failure here must not
// break creating a comment or updating an issue), so callers wrap it in try/catch.

// The stored message. `subject`/`html` are channel-specific: email uses `subject`
// and builds its own HTML from `text`; Telegram sends `html` (parse_mode HTML) and
// falls back to `text`. The sender appends `url` to plain-text bodies.
export interface DeliveryPayload {
  subject?: string;
  text: string;
  html?: string;
  url?: string;
}

interface OutboxRow {
  projectId: number;
  channel: 'email' | 'telegram';
  recipient: string;
  payload: DeliveryPayload;
}

// The issue reference shown in messages, e.g. "IAP-42".
function issueRef(projectKey: string, seq: number): string {
  return `${projectKey}-${seq}`;
}

// The public URL of an issue, or undefined when the web origin is not configured
// (then messages carry no link rather than a localhost fallback).
function issueUrl(projectKey: string, seq: number): string | undefined {
  const base = process.env.APP_URL;
  return base ? `${base}/project/${projectKey}/issue/${seq}` : undefined;
}

// Email copy, addressed to the recipient in the second person.
function emailPayload(
  type: NotificationType,
  ref: string,
  title: string,
  actor: string,
  url: string | undefined,
): DeliveryPayload {
  const line: Record<NotificationType, { subject: string; text: string }> = {
    assigned: { subject: `${ref}: assigned to you`, text: `${actor} assigned this issue to you.` },
    mentioned: {
      subject: `${ref}: you were mentioned`,
      text: `${actor} mentioned you in a comment.`,
    },
    commented: { subject: `${ref}: new comment`, text: `${actor} commented on this issue.` },
    state_changed: {
      subject: `${ref}: status changed`,
      text: `${actor} changed the status of this issue.`,
    },
  };
  const { subject, text } = line[type];
  return { subject, text: `${text}\n\n${ref}: ${title}`, url };
}

// Telegram copy. Rendered as HTML (parse_mode HTML) with the issue reference as a
// clickable link, plus a plain-text fallback. Issue-centric third person, matching
// the email copy without repeating the second-person address.
function telegramPayload(
  type: NotificationType,
  ref: string,
  title: string,
  actor: string,
  url: string | undefined,
): DeliveryPayload {
  const meta: Record<NotificationType, { emoji: string; action: string }> = {
    assigned: { emoji: '📌', action: `Assigned by ${actor}` },
    mentioned: { emoji: '💬', action: `Mentioned by ${actor}` },
    commented: { emoji: '💬', action: `New comment by ${actor}` },
    state_changed: { emoji: '🔄', action: `Status changed by ${actor}` },
  };
  const { emoji, action } = meta[type];

  // HTML (parse_mode=HTML): the issue reference is the clickable link, so no raw URL
  // is shown. A blank line (\n\n) separates the title line from the action line. The
  // plain-text fallback carries no URL here; the sender appends it once.
  const refLink = url
    ? `<a href="${escapeHtml(url)}"><b>${escapeHtml(ref)}</b></a>`
    : `<b>${escapeHtml(ref)}</b>`;
  const html = `${emoji} ${refLink} ${escapeHtml(title)}\n\n<i>${escapeHtml(action)}</i>`;
  const text = `${emoji} ${ref} ${title}\n\n${action}`;
  return { text, html, url };
}

// Enqueues outbound delivery rows for the inbox notifications just created for one
// issue event. All rows in `notifications` share the same issue and actor (both call
// sites operate on a single issue). No-op when the project has no enabled provider or
// no member wants any of the event types present.
export async function enqueueOutbound(
  notifications: NewNotificationRow[],
  actorName: string | null,
): Promise<void> {
  if (notifications.length === 0) return;
  const projectId = notifications[0].projectId;

  const settings = await readRedactedSettings(projectId);

  // The project's own provider when it configured one, otherwise the instance
  // provider when the project asked for it and the instance shares it.
  const source = emailSource(settings);
  const emailEnabled =
    source === 'smtp'
      ? settings.smtp.host.length > 0 && settings.smtp.hasPassword
      : source === 'resend'
        ? settings.resend.hasApiKey
        : source === 'system'
          ? (await getProjectEmailConfig()) !== null
          : false;
  // The project turns Telegram on; the bot that sends is either its own or, when it
  // set no token, the instance bot.
  const telegramEnabled =
    settings.telegram.enabled && (settings.telegram.hasBotToken || (await hasUsableInstanceBot()));
  if (!emailEnabled && !telegramEnabled) return;

  const issueId = notifications[0].issueId;
  const [issueRow] = await db
    .select({ seq: issue.sequenceNumber, title: issue.title })
    .from(issue)
    .where(eq(issue.id, issueId));
  const [projectRow] = await db
    .select({ key: project.key, name: project.name })
    .from(project)
    .where(eq(project.id, projectId));
  if (!issueRow || !projectRow) return;

  const ref = issueRef(projectRow.key, issueRow.seq);
  const url = issueUrl(projectRow.key, issueRow.seq);
  const actor = actorName ?? 'Someone';

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const [users, prefsByUser, chatIdByUser] = await Promise.all([
    db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, userIds)),
    getPreferencesForUsers(projectId, userIds),
    telegramEnabled ? getTelegramChatIds(userIds) : Promise.resolve(new Map<string, string>()),
  ]);
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const out: OutboxRow[] = [];
  for (const n of notifications) {
    const prefs = prefsByUser.get(n.userId);
    if (!prefs) continue; // member has not opted in

    if (emailEnabled && prefs.emailEvents[n.type]) {
      const email = emailById.get(n.userId);
      if (email) {
        out.push({
          projectId,
          channel: 'email',
          recipient: email,
          payload: emailPayload(n.type, ref, issueRow.title, actor, url),
        });
      }
    }
    if (telegramEnabled && prefs.telegramEvents[n.type]) {
      // No linked Telegram account means nowhere to send; the member sees the prompt
      // to link one in the project's notification settings.
      const chatId = chatIdByUser.get(n.userId);
      if (chatId) {
        out.push({
          projectId,
          channel: 'telegram',
          recipient: chatId,
          payload: telegramPayload(n.type, ref, issueRow.title, actor, url),
        });
      }
    }
  }

  if (out.length === 0) return;
  await db.insert(notificationDelivery).values(out);
}
