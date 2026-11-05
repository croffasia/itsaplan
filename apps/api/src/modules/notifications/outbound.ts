import {
  db,
  notificationDelivery,
  issue,
  issueActivity,
  project,
  projectDocument,
  team,
  user,
  emailSource,
  getProjectEmailConfig,
  type DeliveryPayload,
} from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { composeEmail, isAccountDeactivated, savedLocales } from '@repo/auth';
import { DEFAULT_LOCALE, emailWords, type CoreEmailKey, type Locale } from '@repo/mailer';
import { readRedactedSettings } from '#modules/notification-settings/service';
import { getPreferencesForUsers } from '#modules/notification-preferences/service';
import { getTelegramChatIds, hasUsableInstanceBot } from '#modules/telegram/service';
import { escapeHtml } from '#shared/lib';
import { commentUrl, documentUrl, issueUrl, teamRef } from '#modules/teams/ref';
import type { NotificationType, NewNotificationRow } from './service';

// Outbound notification delivery: turns the inbox notification rows produced by an
// issue or document event into notification_delivery outbox rows. Delivery is per
// member and per their own preferences: for each inbox row (already one per
// recipient), the member's notification-preferences decide whether it goes by email
// (to their account address) and/or Telegram (to the chat of the Telegram account
// they linked). The team that owns the project supplies the provider credentials
// (SMTP/Resend, and optionally its own bot token — Telegram otherwise goes through
// the instance bot). The message text is composed here at enqueue time and stored on
// the row; the worker drains the outbox and the sender reads the credentials at send
// time.
//
// This is best-effort: enqueue never throws into the caller (a failure here must not
// break creating a comment or updating an issue), so callers wrap it in try/catch.

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

interface StateChange {
  from: string;
  to: string;
}

async function readStateChange(activityId: number): Promise<StateChange | null> {
  const [row] = await db
    .select({ payload: issueActivity.payload })
    .from(issueActivity)
    .where(eq(issueActivity.id, activityId));
  const from = row?.payload.from?.value;
  const to = row?.payload.to?.value;
  if (!from || !to) return null;
  return { from, to };
}

const EMAIL_TEMPLATE: Record<NotificationType, CoreEmailKey> = {
  assigned: 'assigned',
  mentioned: 'mentioned',
  commented: 'commented',
  state_changed: 'stateChanged',
};

// Telegram copy. Rendered as HTML (parse_mode HTML) with the issue reference as a
// clickable link, plus a plain-text fallback. Issue-centric third person, matching
// the email copy without repeating the second-person address.
function telegramPayload(
  type: NotificationType,
  ref: string,
  title: string,
  actor: string,
  url: string | undefined,
  stateChange: StateChange | null,
): DeliveryPayload {
  const meta: Record<NotificationType, { emoji: string; action: string }> = {
    assigned: { emoji: '📌', action: `Assigned by ${actor}` },
    mentioned: { emoji: '💬', action: `Mentioned by ${actor}` },
    commented: { emoji: '💬', action: `New comment by ${actor}` },
    state_changed: {
      emoji: '🔄',
      action: stateChange
        ? `Status changed from ${stateChange.from} to ${stateChange.to} by ${actor}`
        : `Status changed by ${actor}`,
    },
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

// A document only sends 'mentioned'. The title is the link in Telegram, as the issue
// reference is.
function documentTelegramPayload(
  title: string,
  actor: string,
  url: string | undefined,
): DeliveryPayload {
  const action = `Mentioned by ${actor}`;
  const titleLink = url
    ? `<a href="${escapeHtml(url)}"><b>${escapeHtml(title)}</b></a>`
    : `<b>${escapeHtml(title)}</b>`;
  return {
    text: `💬 ${title}\n\n${action}`,
    html: `💬 ${titleLink}\n\n<i>${escapeHtml(action)}</i>`,
    url,
  };
}

interface Messages {
  email: (type: NotificationType, locale: Locale) => Promise<DeliveryPayload>;
  telegram: (type: NotificationType) => DeliveryPayload;
}

// The copy of one event, about the issue or the document its rows point at. Null when
// that is gone. A comment's event links to the comment.
async function composeMessages(
  notifications: NewNotificationRow[],
  projectRow: { key: string; teamId: number; teamSlug: string | null },
  actorName: string | null,
  commentId: number | null,
): Promise<Messages | null> {
  const actor = actorName ?? 'Someone';
  const first = notifications[0];
  const ref = teamRef({ id: projectRow.teamId, slug: projectRow.teamSlug });
  if (first.documentId != null) {
    const documentId = first.documentId;
    const [documentRow] = await db
      .select({ title: projectDocument.title })
      .from(projectDocument)
      .where(eq(projectDocument.id, documentId));
    if (!documentRow) return null;
    const title = documentRow.title.trim();
    const url = documentUrl(ref, projectRow.key, documentId);
    const template =
      first.documentCommentId != null ? 'documentCommentMentioned' : 'documentMentioned';
    return {
      email: async (_type, locale) => {
        const words = emailWords(locale);
        const vars = { actor: actorName ?? words.someone, document: title || words.untitled };
        return { ...(await composeEmail(template, locale, vars, url)), url };
      },
      telegram: () => documentTelegramPayload(title || 'Untitled', actor, url),
    };
  }
  if (first.issueId == null) return null;
  const [issueRow] = await db
    .select({ seq: issue.sequenceNumber, title: issue.title })
    .from(issue)
    .where(eq(issue.id, first.issueId));
  if (!issueRow) return null;
  const issueKey = issueRef(projectRow.key, issueRow.seq);
  const url =
    commentId != null
      ? commentUrl(ref, projectRow.key, issueRow.seq, commentId)
      : issueUrl(ref, projectRow.key, issueRow.seq);
  // One issue event, so every 'state_changed' row points at the same activity row.
  const statusActivityId =
    notifications.find((n) => n.type === 'state_changed')?.sourceActivityId ?? null;
  const stateChange = statusActivityId != null ? await readStateChange(statusActivityId) : null;
  return {
    email: async (type, locale) => {
      const vars = {
        actor: actorName ?? emailWords(locale).someone,
        ref: issueKey,
        title: issueRow.title,
        from: stateChange?.from ?? '—',
        to: stateChange?.to ?? '—',
      };
      return { ...(await composeEmail(EMAIL_TEMPLATE[type], locale, vars, url)), url };
    },
    telegram: (type) => telegramPayload(type, issueKey, issueRow.title, actor, url, stateChange),
  };
}

// Enqueues outbound delivery rows for the inbox notifications just created for one
// event. All rows in `notifications` share the same issue or document and actor (every
// call site operates on one of them). No-op when the team has no enabled provider or
// no member wants any of the event types present.
export async function enqueueOutbound(
  notifications: NewNotificationRow[],
  actorName: string | null,
  commentId: number | null,
): Promise<void> {
  if (notifications.length === 0) return;
  const projectId = notifications[0].projectId;

  const [projectRow] = await db
    .select({ key: project.key, name: project.name, teamId: project.teamId, teamSlug: team.slug })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(eq(project.id, projectId));
  if (!projectRow) return;

  const settings = await readRedactedSettings(projectRow.teamId);

  // The team's own provider when it configured one, otherwise the instance
  // provider when the team asked for it and the instance shares it.
  const source = emailSource(settings);
  const emailEnabled =
    source === 'smtp'
      ? settings.smtp.host.length > 0 && settings.smtp.hasPassword
      : source === 'resend'
        ? settings.resend.hasApiKey
        : source === 'system'
          ? (await getProjectEmailConfig()) !== null
          : false;
  // The team turns Telegram on; the bot that sends is either its own or, when it
  // set no token, the instance bot.
  const telegramEnabled =
    settings.telegram.enabled && (settings.telegram.hasBotToken || (await hasUsableInstanceBot()));
  if (!emailEnabled && !telegramEnabled) return;

  const messages = await composeMessages(notifications, projectRow, actorName, commentId);
  if (!messages) return;

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const [users, prefsByUser, chatIdByUser, localeByUser] = await Promise.all([
    db
      .select({ id: user.id, email: user.email, active: user.active })
      .from(user)
      .where(inArray(user.id, userIds)),
    getPreferencesForUsers(projectId, userIds),
    telegramEnabled ? getTelegramChatIds(userIds) : Promise.resolve(new Map<string, string>()),
    savedLocales(userIds),
  ]);
  // A deactivated account keeps its projects, but nothing from them reaches it.
  const emailById = new Map(
    users.filter((u) => !isAccountDeactivated(u)).map((u) => [u.id, u.email]),
  );

  // Everyone told the same thing in one language gets the same email, composed once.
  const emails = new Map<string, Promise<DeliveryPayload>>();
  const emailFor = (type: NotificationType, locale: Locale) => {
    const key = `${type}:${locale}`;
    const email = emails.get(key) ?? messages.email(type, locale);
    emails.set(key, email);
    return email;
  };

  const out: OutboxRow[] = [];
  for (const n of notifications) {
    const prefs = prefsByUser.get(n.userId);
    const email = emailById.get(n.userId);
    if (!prefs || !email) continue; // not opted in, or deactivated

    if (emailEnabled && prefs.emailEvents[n.type]) {
      out.push({
        projectId,
        channel: 'email',
        recipient: email,
        payload: await emailFor(n.type, localeByUser.get(n.userId) ?? DEFAULT_LOCALE),
      });
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
          payload: messages.telegram(n.type),
        });
      }
    }
  }

  if (out.length === 0) return;
  await db.insert(notificationDelivery).values(out);
}
