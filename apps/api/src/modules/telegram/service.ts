import { db, appSecret, userTelegramAccount } from '@repo/db';
import { and, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import { randomBytes } from 'node:crypto';

// The instance Telegram bot and the account links it creates.
//
// One bot serves the whole instance: it is what a user talks to when linking their
// Telegram account, and the default sender for Telegram notifications (a project may
// still set its own bot token, which wins for that project's deliveries). The token
// is a secret, so it lives encrypted in app_secret under 'telegram.bot' with a
// `redacted` mirror for the settings UI, the same shape as the instance mail and
// Google credentials in @repo/auth.
//
// A link is one row in user_telegram_account per user: created with a one-time
// link_code when the user asks to link, completed by the bot when that code arrives
// as `/start <code>`. chat_id null means the link is still pending.

const BOT_SECRET_KEY = 'telegram.bot';

// How long a `/start` code stays valid. Long enough to switch to Telegram and press
// the button, short enough that an intercepted link is not useful later.
const LINK_CODE_TTL_MINUTES = 15;

// The stored, decrypted bot config. Read by the delivery sender and handed to the
// bot service over the internal API; never returned to a browser.
export interface InstanceBotConfig {
  enabled: boolean;
  botToken: string; // secret
  // Resolved from getMe when the token is saved, so the deep link can be built
  // without asking the administrator to type the name a second time.
  botUsername: string;
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

function defaultBotConfig(): InstanceBotConfig {
  return { enabled: false, botToken: '', botUsername: '' };
}

function toBotDto(config: InstanceBotConfig): InstanceBotDto {
  return {
    enabled: config.enabled,
    botUsername: config.botUsername,
    hasBotToken: config.botToken.length > 0,
  };
}

export async function getInstanceBotConfig(): Promise<InstanceBotConfig> {
  const rows = await db
    .select({ ciphertext: appSecret.ciphertext, iv: appSecret.iv, authTag: appSecret.authTag })
    .from(appSecret)
    .where(eq(appSecret.key, BOT_SECRET_KEY));
  const row = rows[0];
  if (!row) return defaultBotConfig();
  // Merge over the default so a config written before a field was added stays valid.
  return { ...defaultBotConfig(), ...(JSON.parse(decryptSecret(row)) as InstanceBotConfig) };
}

export async function getInstanceBotSettings(): Promise<InstanceBotDto> {
  return toBotDto(await getInstanceBotConfig());
}

// Whether the instance bot can be used right now. Account linking is offered only
// when this is true, and Telegram delivery falls back to this bot only when it is.
export function isInstanceBotUsable(config: InstanceBotConfig): boolean {
  return config.enabled && config.botToken.length > 0;
}

export async function hasUsableInstanceBot(): Promise<boolean> {
  return isInstanceBotUsable(await getInstanceBotConfig());
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
  const enc = encryptSecret(JSON.stringify(next));
  const redacted = toBotDto(next);
  await db
    .insert(appSecret)
    .values({
      key: BOT_SECRET_KEY,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      redacted,
    })
    .onConflictDoUpdate({
      target: appSecret.key,
      set: {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        redacted,
        updatedAt: sql`now()`,
      },
    });
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

export interface ConfirmLinkInput {
  code: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
}

export type ConfirmLinkResult =
  { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'taken' };

// Completes a link from the bot: matches the code, then writes the chat id onto that
// user's row and clears the code so it cannot be replayed. 'invalid' covers an
// unknown, already-used, or expired code — the bot tells the user to start again
// either way. 'taken' means this Telegram account is already linked to someone else.
export async function confirmTelegramLink(input: ConfirmLinkInput): Promise<ConfirmLinkResult> {
  const rows = await db
    .select({ userId: userTelegramAccount.userId })
    .from(userTelegramAccount)
    .where(
      and(
        eq(userTelegramAccount.linkCode, input.code),
        gt(userTelegramAccount.linkCodeExpiresAt, new Date()),
      ),
    );
  const pending = rows[0];
  if (!pending) return { ok: false, reason: 'invalid' };

  const conflict = await db
    .select({ userId: userTelegramAccount.userId })
    .from(userTelegramAccount)
    .where(
      and(
        eq(userTelegramAccount.chatId, input.chatId),
        ne(userTelegramAccount.userId, pending.userId),
      ),
    );
  if (conflict.length > 0) return { ok: false, reason: 'taken' };

  await db
    .update(userTelegramAccount)
    .set({
      chatId: input.chatId,
      username: input.username,
      firstName: input.firstName,
      linkedAt: new Date(),
      linkCode: null,
      linkCodeExpiresAt: null,
    })
    .where(eq(userTelegramAccount.userId, pending.userId));
  return { ok: true, userId: pending.userId };
}
