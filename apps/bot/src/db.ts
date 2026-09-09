import { and, eq, gt, ne } from 'drizzle-orm';
import { db, readSecret, userTelegramAccount } from '@repo/db';

// Everything the bot reads and writes in the database: the instance bot settings the
// api stores, and the account links it redeems.
//
// The settings row is written by the api under 'telegram.bot' and only read here, so
// the two sides carry the key and the fields this service needs; a field added to the
// stored config for the bot has to be added on both.

const BOT_SECRET_KEY = 'telegram.bot';

export interface InstanceBotConfig {
  enabled: boolean;
  botToken: string; // secret
}

export async function getInstanceBotConfig(): Promise<InstanceBotConfig> {
  const stored = await readSecret<InstanceBotConfig>(BOT_SECRET_KEY);
  // Merge over the default so a row written before a field was added stays valid.
  return { enabled: false, botToken: '', ...stored };
}

// Whether the instance bot can be used right now: the supervisor polls Telegram only
// while this holds.
export function isInstanceBotUsable(config: InstanceBotConfig): boolean {
  return config.enabled && config.botToken.length > 0;
}

export interface ConfirmLinkInput {
  code: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
}

export type ConfirmLinkResult =
  { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'taken' };

// Completes a link: matches the code the api minted, then writes the chat id onto that
// user's row and clears the code so it cannot be replayed. 'invalid' covers an
// unknown, already-used, or expired code — the user is told to start again either
// way. 'taken' means this Telegram account is already linked to someone else.
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
