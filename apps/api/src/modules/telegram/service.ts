import {
  db,
  userTelegramAccount,
  writeSecret,
  getInstanceBotConfig,
  isInstanceBotUsable,
  TELEGRAM_BOT_SECRET_KEY,
  type InstanceBotConfig,
} from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

// The instance Telegram bot and the account links it creates.
//
// One bot serves the whole instance: it is what a user talks to when linking their
// Telegram account, and the default sender for Telegram notifications (a project may
// still set its own bot token, which wins for that project's deliveries). The token
// is a secret, so it lives encrypted in app_secret under 'telegram.bot' with a
// `redacted` mirror for the settings UI. The stored shape and its reader are in
// @repo/db, shared with the bot and the worker; what is here is the write side.
//
// A link is one row in user_telegram_account per user: created with a one-time
// link_code here, redeemed by the bot when that code arrives as `/start <code>`.
// chat_id null means the link is still pending.

// How long a `/start` code stays valid. Long enough to switch to Telegram and press
// the button, short enough that an intercepted link is not useful later.
const LINK_CODE_TTL_MINUTES = 15;

export async function hasUsableInstanceBot(): Promise<boolean> {
  return isInstanceBotUsable(await getInstanceBotConfig());
}

// The config as returned to the client: the token replaced by a boolean telling
// whether one is stored.
export interface InstanceBotDto {
  enabled: boolean;
  botUsername: string;
  hasBotToken: boolean;
}

// A partial write. The token keeps its stored value when omitted or sent empty (a
// masked field the administrator did not edit).
export interface InstanceBotPatch {
  enabled?: boolean;
  botToken?: string;
}

function toBotDto(config: InstanceBotConfig): InstanceBotDto {
  return {
    enabled: config.enabled,
    botUsername: config.botUsername,
    hasBotToken: config.botToken.length > 0,
  };
}

export async function getInstanceBotSettings(): Promise<InstanceBotDto> {
  return toBotDto(await getInstanceBotConfig());
}

// Asks Telegram who the token belongs to. Doubles as validation: a bad token is
// rejected before it is stored, so the administrator finds out at save time rather
// than from silently undelivered notifications.
export async function fetchBotUsername(botToken: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('Could not reach Telegram to verify the bot token');
  }
  if (!res.ok) throw new Error('Telegram rejected this bot token');
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { username?: string };
  } | null;
  const username = body?.ok ? body.result?.username : undefined;
  if (!username) throw new Error('Telegram rejected this bot token');
  return username;
}

export async function setInstanceBotSettings(patch: InstanceBotPatch): Promise<InstanceBotDto> {
  const current = await getInstanceBotConfig();
  const botToken = patch.botToken && patch.botToken.length > 0 ? patch.botToken : current.botToken;
  // Ask Telegram for the name only when there is something new to resolve: a token
  // that changed, or a stored one whose username was never recorded. An unchanged
  // token keeps the name already resolved for it, so saving an unrelated field does
  // not depend on Telegram being reachable.
  const needsLookup =
    botToken.length > 0 && (botToken !== current.botToken || current.botUsername.length === 0);
  const next: InstanceBotConfig = {
    enabled: patch.enabled ?? current.enabled,
    botToken,
    botUsername: needsLookup ? await fetchBotUsername(botToken) : current.botUsername,
  };
  const redacted = toBotDto(next);
  await writeSecret(TELEGRAM_BOT_SECRET_KEY, next, redacted);
  return redacted;
}

// ── Account links ─────────────────────────────────────────────────────────────

// A user's linked Telegram account. `chatId` is what Telegram deliveries are
// addressed to; the name fields exist so the user can tell which account it is.
export interface TelegramLink {
  chatId: string;
  username: string | null;
  firstName: string | null;
  linkedAt: string;
}

export async function getTelegramLink(userId: string): Promise<TelegramLink | null> {
  const rows = await db
    .select({
      chatId: userTelegramAccount.chatId,
      username: userTelegramAccount.username,
      firstName: userTelegramAccount.firstName,
      linkedAt: userTelegramAccount.linkedAt,
    })
    .from(userTelegramAccount)
    .where(eq(userTelegramAccount.userId, userId));
  const row = rows[0];
  if (!row?.chatId || !row.linkedAt) return null;
  return {
    chatId: row.chatId,
    username: row.username,
    firstName: row.firstName,
    linkedAt: row.linkedAt.toISOString(),
  };
}

// The chat ids of several users at once, for the notification enqueue path. Users
// with no completed link are absent from the map.
export async function getTelegramChatIds(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userTelegramAccount.userId, chatId: userTelegramAccount.chatId })
    .from(userTelegramAccount)
    .where(inArray(userTelegramAccount.userId, userIds));
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.chatId) map.set(row.userId, row.chatId);
  }
  return map;
}

// Starts a link: mints a one-time code and stores it on the user's row. An existing
// link is left in place until the new code is confirmed, so a failed re-link does not
// leave the user with no Telegram at all.
export async function startTelegramLink(
  userId: string,
): Promise<{ code: string; expiresAt: string }> {
  // base64url of 16 random bytes: 22 characters, all valid in a `/start` payload
  // (Telegram allows A-Z a-z 0-9 _ - up to 64 characters).
  const code = randomBytes(16).toString('base64url');
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000);
  await db
    .insert(userTelegramAccount)
    .values({ userId, linkCode: code, linkCodeExpiresAt: expiresAt })
    .onConflictDoUpdate({
      target: userTelegramAccount.userId,
      set: { linkCode: code, linkCodeExpiresAt: expiresAt },
    });
  return { code, expiresAt: expiresAt.toISOString() };
}

export async function unlinkTelegram(userId: string): Promise<void> {
  await db.delete(userTelegramAccount).where(eq(userTelegramAccount.userId, userId));
}
